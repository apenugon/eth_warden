import Head from 'next/head'
import { Inter } from '@next/font/google'
import { Alert, AlertIcon, Box, Button, Container, FormControl, FormHelperText, FormLabel, Heading, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Progress, Text } from '@chakra-ui/react'
// @ts-ignore
import wasm_buffer from '../circuits/cc_prove_decryption/prove_decryption_js/prove_decryption.wasm';
const snarkjs = require('snarkjs')
import { SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useContractRead, useProvider, usePrepareContractWrite, useContractWrite, useWaitForTransaction, goerli } from 'wagmi'
import password_manager_info from "../artifacts/src/passwordManager.sol/PasswordManager.json";
import { PasswordManager } from '../typechain-types'
import { polygon } from '@wagmi/core/chains'
import { decrypt, DecryptionOutput, getCalldataFromMessage } from '../utils/zkutils'
import localforage from 'localforage';
import { abort } from 'process';
import { DownloadMessage } from '../utils/download-zkey';
const password_manager_abi = password_manager_info.abi;
import { ethers } from 'ethers';
import Link from 'next/link';


const inter = Inter({ subsets: ['latin'] })

function toBuffer(ab: ArrayBuffer) {
  const buf = Buffer.alloc(ab.byteLength);
  const view = new Uint8Array(ab);
  for (let i = 0; i < buf.length; ++i) {
      buf[i] = view[i];
  }
  return buf;
}

async function readRemoteFile (file: string) {
  let response = await fetch(file)
  if (!response.ok) {
      throw new Error("HTTP error " + response.status);
  }
  return toBuffer(await response.arrayBuffer());
}

enum page {
  VIEW,
  CREATE,
  UPDATE,
  DELETE,
  PULL,
  LOADING,
  LOGGED_OUT // Logged out
}
const modalHeader = new Map<page, string>();
modalHeader.set(page.PULL, "Decrypt all account info");
modalHeader.set(page.CREATE, "Add a new account");
modalHeader.set(page.UPDATE, "Update an account");
modalHeader.set(page.DELETE, "Delete an account");
modalHeader.set(page.LOADING, "Loading data...");
modalHeader.set(page.LOGGED_OUT, "Please connect your wallet");
const modalSubtext = new Map<page, string>();
modalSubtext.set(page.PULL, "This will decrypt all of your account info and display it on the screen. Please pick a master password that is long and secure. We use a password hashing scheme on the backend so your AES password is tough to guess, but the longer and more complicated this password is the better.\n\nIMPORTANT: DO NOT FORGET YOUR MASTER PASSWORD OR YOUR PASSWORDS WILL BE UNRECOVERABLE.");
modalSubtext.set(page.CREATE, "Please enter the account label, your username, and password. This frontend will encrypt the password using a hash of your master password and store it on the blockchain. We will also store the account name on the blockchain.\n Please be aware that this data will be stored in its encrypted form on the blockchain, and will *forever* be publically visible in that form. It may be deleted, but nodes will have archived copies.");
modalSubtext.set(page.UPDATE, "Please enter your updated username and password. This frontend will encrypt the password using a hash of your master password and store it on the blockchain. We will also store the account name on the blockchain.");
modalSubtext.set(page.DELETE, "");
modalSubtext.set(page.LOADING, "Please wait while we load your data from the blockchain. This may take a few seconds.");
modalSubtext.set(page.LOGGED_OUT, "Please connect your wallet to continue.");

const PASSWORD_MANAGER_ADDRESS = '0xBf30a0f337eF6a64Ae0e39F1596BBFeEC182e348';

export default function Home() {
  const { address, isConnecting, isConnected, isDisconnected, connector: activeConnector  } = useAccount();
  const { connect, connectors, error, pendingConnector } = useConnect({
    chainId: polygon.id
  });
  const { disconnect } = useDisconnect();

  const { data, error: contractError, isLoading, isSuccess: contractIsSuccess, refetch }: 
    {data: PasswordManager.AccountInfoViewStructOutput[] | undefined, error: Error | null, isLoading: boolean, isSuccess: boolean, refetch: any} = useContractRead({
    address: PASSWORD_MANAGER_ADDRESS,
    abi: password_manager_abi,
    functionName: 'fetchAllAccountInfo',
    overrides: { from: address },
    onSettled(data, error) {
      console.log('Settled read', { data, error })
      console.log("Address", address);
    },
  });

  const [decryptedInfo, setDecryptedInfo] = useState<DecryptionOutput[]>([]);
  const [privateKey, setPrivateKey] = useState<string>("");
  const [infoToAddUpdate, setInfoToAddUpdate] = useState<DecryptionOutput>(new DecryptionOutput());
  const [params, setParams] = useState< [[string, string], [[string, string], [string, string]], [string, string], [string, string, string], string, string]>();
  const [readyToCall, setReadyToCall] = useState<boolean>(false);
  const [rawLabelToDelete, setRawLabelToDelete] = useState<string>("");
  
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [dataIsStored, setDataIsStored] = useState<boolean>(false);

  const workerRef = useRef<Worker>()
  
  const startDownload = async () => {

    setIsDownloading(true);
    const messageToSend: DownloadMessage = {
      type: "started",
      url: window.location.toString()
    };
    workerRef.current?.postMessage(messageToSend);
    
  };

  const cancelDownload = () => {
    const messageToSend: DownloadMessage = {
      type: "cancelled",
    };
    workerRef.current?.postMessage(messageToSend);
    setIsDownloading(false);
  };

  let [pageState, setPageState] = useState<page>(isConnected ? page.PULL : page.LOGGED_OUT);
  const { config, error: writeError } = usePrepareContractWrite({
    address: PASSWORD_MANAGER_ADDRESS,
    abi: password_manager_abi,
    functionName: 'updateAccountInfo',
    args: params,
    enabled: readyToCall,
    onSettled(data, error) {
      console.log("Prepare write settled", data);
    },
  })

  const { config: deleteConfig, error: deleteError } = usePrepareContractWrite({
    address: PASSWORD_MANAGER_ADDRESS,
    abi: password_manager_abi,
    functionName: 'deleteAccountInfo',
    args: [rawLabelToDelete],
    enabled: readyToCall,
    onSettled(data, error) {
      console.log("Prepare write settled", data);
    },
  })

  const { data: deleteContractData, write: deleteWrite, isLoading: deleteLoading } = useContractWrite(    {
    ...deleteConfig,
    onSettled(settleData, error) {
      console.log("Settled", settleData, error);
      settleData?.wait().then((data) => {
        console.log("Confirmed", data);
      });
    },
  });

  const { data: contractData, write } = useContractWrite(
    {
      ...config,
      onSettled(settleData, error) {
        console.log("Settled", settleData, error);
        settleData?.wait().then((data) => {
          console.log("Confirmed", data);
        });
      },
    });

  const { isSuccess, isLoading: transactionLoading, error: txError, isError } = useWaitForTransaction({
    hash: deleteLoading? deleteContractData?.hash : contractData?.hash,
    onSuccess: async (data) => {
      console.log("Success", data);
      setRawLabelToDelete("");
      setParams(undefined);
      // sleep for 1 second
      await new Promise(r => setTimeout(r, 1000));
      await refetch();
      setPageState(page.PULL);
      setReadyToCall(false);
    }    
  })

  // Initialization
  useEffect(() => {
    console.log("Initialize");
    const callback = (err: any, value: any) => {
      console.log("In callback", value);
      if (err) {
        console.error(err);
      } else if (value) {
        setDataIsStored(true);
      }
    }
    localforage.getItem("circuit_final.zkey", callback);
    workerRef.current = new Worker(new URL('../utils/download-zkey.ts', import.meta.url))
    workerRef.current.onmessage = (event: MessageEvent<DownloadMessage>) => {
      switch (event.data.type) {
        case 'progress':
          setDownloadProgress(event.data.progress!)
          break
        case 'done':
          setDataIsStored(true);
          setIsDownloading(false)
          break
        case 'error':
          console.error(event.data.error)
          setIsDownloading(false)
          break
      }
    }

    return () => {
      workerRef.current!.terminate()
    }

  }, []);

  useEffect(() => {
    console.log("Data updated", data, isLoading, contractIsSuccess);
    if (data == undefined) {
    }
  }, [data, isLoading, contractIsSuccess])

  useEffect(() => {

    if (params !== undefined || rawLabelToDelete !== "") {
      console.log("Params changed", params);
      setReadyToCall(true);
    }
  }, [params, rawLabelToDelete])

  useEffect(() => {

    console.log("wait for transaction changed", isSuccess, transactionLoading, txError, isError);
    
  }, [isSuccess, transactionLoading, txError, isError])

  let handleSubmit = async () => {
    setReadyToCall(false);
    switch (pageState) {
      case page.PULL: {
      setPageState(page.LOADING);
      console.log("Data", data);
      let wasmBuffer = await readRemoteFile(wasm_buffer); // Should probably do this on page load, just incorporate as an inline resource
      const decrypted = await decrypt(data!, privateKey, wasmBuffer);
      setDecryptedInfo(decrypted);
      console.log(decrypted);
      setPageState(page.VIEW);
      console.log("Data", data, isLoading);
      break;
    } 
    case page.CREATE:
    case page.UPDATE: {
      setPageState(page.LOADING);
      console.log("Adding", infoToAddUpdate);
      let calldata = await getCalldataFromMessage(
        infoToAddUpdate!.username,
        infoToAddUpdate!.password,
        infoToAddUpdate!.label,
        privateKey,
      )
      console.log("Calldata", calldata);
      setParams(calldata);
      console.log("params", params)
    }
    case page.DELETE: {
      setPageState(page.LOADING);
      console.log("Deleting", infoToAddUpdate);
      setRawLabelToDelete(infoToAddUpdate!.rawLabel);
    }
  }
  }

  let handleExecuteTx = async () => {
    if (params) {
      write?.()
    } else if (rawLabelToDelete !== "") {
      deleteWrite?.();
    }
  }

  let handleUpdateButton = async (info: DecryptionOutput) => {
    console.log("Updating", infoToAddUpdate);
    setInfoToAddUpdate(info);
    setPageState(page.UPDATE);
  }


  let handleDeleteButton = async (info: DecryptionOutput) => {
    console.log("Deleting", infoToAddUpdate);
    setInfoToAddUpdate(info);
    setPageState(page.DELETE);
  }

  return (
    <>
    <Head>
      <title>EthWarden</title>
    </Head>
    <Container bg="pink.400" h="full" rounded="3xl" mt={10} pb={6} shadow="md">
    <Text fontSize="6xl" padding={6} textAlign="center" color="white">ETHWarden</Text>


    {dataIsStored ? (
        <>
        
<Container centerContent bg="purple.200" rounded="lg" shadow="md">
  <Box p={8}>
    {!isConnected && 
      <>
        <Heading textAlign="center" as="h4" fontSize="2xl" color="gray.700">Connect your Wallet to securely* store your passwords on the blockchain.</Heading>
      </>
    }
    <Text fontSize="md" mt={2} color="gray.700">This app uses a Zero-Knowledge proof to encrypt your password with AES-256 encryption, and stores the password in a smart contract. This contract will only accept password storage if the password has been provably encrypted with AES-256. Therefore, you *know* that your passwords are unable to be broken if they are stored there.</Text>
    <Text fontSize="md" mt={2} color="gray.600">Note: Currently, this app only supports Polygon - will put this up on mainnet if there is interest too.</Text>
    <Link href={"https://polygonscan.com/address/"+PASSWORD_MANAGER_ADDRESS}><Button as="a">View contract on PolygonScan</Button></Link>
    <br/>
    {connectors.map((connector) => (
      <Button
        hidden={isConnected || pageState != page.LOGGED_OUT}
        key={connector.id}
        size="lg"
        variant="outline"
        m={4}
        onClick={async () => {
          if (window.ethereum) {
            try {
              // Try to switch to the Mumbai testnet
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x89' }], // Check networks.js for hexadecimal network ids
              });
            } catch (error) {
              // This error code means that the chain we want has not been added to MetaMask
              // In this case we ask the user to add it to their MetaMask
              // @ts-ignore
              if (error.code === 4902) {
                try {
                  await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                      {
                        chainId: "0x89",
                        chainName: "Polygon Mainnet",
                        nativeCurrency: {
                          name: "MATIC",
                          symbol: "MATIC",
                          decimals: 18
                        },
                        rpcUrls: ["https://rpc-mainnet.maticvigil.com/"],
                        blockExplorerUrls: ["https://polygonscan.com/"]
                      },
                    ],
                  });
                } catch (error) {
                  console.log(error);
                }
              }
              console.log(error);
            }
          } else {
            // If window.ethereum is not found then MetaMask is not installed
            alert('MetaMask is not installed. Please install it to use this app: https://metamask.io/download.html');
          } 

          connect({ connector });
          setPageState(page.PULL);
        }}
      >
        Connect Wallet
        {isLoading &&
          pendingConnector?.id === connector.id &&
          ' (connecting)'}
      </Button>
    ))}
    <Button
      hidden={!isConnected || pageState == page.LOGGED_OUT}
      size="lg"
      variant="outline"
      m={4}
      onClick={() => {
        disconnect()
        setPageState(page.LOGGED_OUT);
      }}
    >
      Disconnect
    </Button>
    {isConnected && <Text fontSize="lg" mt={4} fontWeight="bold">Connected Wallet: {address}</Text>}
    {error && <Alert status="error" mt={4}>{error.message}</Alert>}
  </Box>
</Container>
      {isConnected && 
      (
      <>
    <Box p={8} mt={8}>
    { decryptedInfo.length == 0 && pageState == page.VIEW && 

    <Box mt={4} p={4} shadow="md" bg="white" rounded="lg">
      <Text textAlign="center" fontSize="lg">No passwords stored! Try refreshing or storing your first password.</Text>
    </Box>
    }
    {decryptedInfo.map((info) => (
        <Box key={info.rawLabel} mt={4} p={4} shadow="md" bg="white" rounded="lg">
            <Text fontWeight="bold">{info.label}</Text>
            <Text mt={2} fontSize="md">Username: {info.username}</Text>
            <Text mt={2} fontSize="md">Password: {info.password}</Text>
            <Box mt={4} display="flex" justifyContent="flex-end">
            <Button ml={4} onClick={() => handleDeleteButton(info)} disabled={pageState != page.VIEW}>
            Delete
            </Button>
            </Box>
        </Box>
    ))}
    </Box>
    
    <Button
    onClick={() => setPageState(page.CREATE)}
    disabled={pageState !== page.VIEW}
    >
    Store
  </Button>
  <Button
    onClick={() => setPageState(page.PULL)}
    disabled={pageState !== page.VIEW}
    >
    Refresh Accounts
  </Button>
  {contractError &&  <Alert status="error" mt={2}>
  <AlertIcon />
  {contractError.message}
</Alert> }

<Modal isOpen={pageState !== page.VIEW} onClose={() => setPageState(page.VIEW)}>
<ModalOverlay />
<ModalContent>
<ModalHeader fontWeight="bold">{modalHeader.get(pageState)}</ModalHeader>
<ModalCloseButton />
<ModalBody p={6}>
<Text fontSize="sm">{modalSubtext.get(pageState)}</Text>
{ pageState !== page.LOADING && pageState !== page.DELETE &&
<FormControl aria-autocomplete='none'>
<FormLabel htmlFor="privateKey">Master Password</FormLabel>
<Input type="password" id="privateKey" value={privateKey} onChange={event => setPrivateKey(event.target.value)} />
</FormControl>
}
{ (pageState === page.CREATE || pageState === page.UPDATE) &&
<FormControl aria-autocomplete='none'>
<FormLabel htmlFor="label">Label</FormLabel>
<Input type="text" id="label" value={infoToAddUpdate.label} onChange={event => setInfoToAddUpdate({...infoToAddUpdate, label: event.target.value})} />
<FormLabel htmlFor="username">Username</FormLabel>
<Input type="text" id="username" value={infoToAddUpdate.username} onChange={event => setInfoToAddUpdate({...infoToAddUpdate, username: event.target.value})} />
<FormLabel htmlFor="password">Password</FormLabel>
<Input type="text" id="password" value={infoToAddUpdate.password} onChange={event => setInfoToAddUpdate({...infoToAddUpdate, password: event.target.value})} />
</FormControl>
}
{ pageState === page.DELETE &&
<Text fontSize="sm">Are you sure you want to delete?</Text>
}
{ transactionLoading &&
<Text fontSize="sm">Transaction in progress, waiting for confirmation...</Text>
}
{ isLoading &&
<Text fontSize="sm">Reading latest accounts from chain...</Text>
}
</ModalBody>
<ModalFooter>
<Button onClick={() => handleSubmit()} isDisabled={pageState === page.LOADING}>
Submit
</Button>
{ pageState === page.LOADING && readyToCall &&
<Button onClick={handleExecuteTx} isDisabled={transactionLoading}>Execute transaction</Button>
}
</ModalFooter>
</ModalContent>
</Modal></>)
    }
        </>
      ) : (
        <div>
                <>
        <Heading textAlign="center" as="h4" fontSize="2xl" color="gray.700">Start storing your passwords on EthWarden. Download the app first - you will only need to do this once per device.</Heading>
        <Text fontSize="md" mt={2} color="gray.700">This app uses a Zero-Knowledge proof to encrypt your password with AES-256 encryption, and stores the password in a smart contract. This contract will only accept password storage if the password has been provably encrypted with AES-256. Therefore, you *know* that your passwords are unable to be broken if they are stored there.</Text>
        <Text fontSize="md" mt={2} color="gray.600">Note: Currently, this app only supports Polygon - will put this up on mainnet if there is interest too.</Text>
        <Link href={"https://polygonscan.com/address/"+PASSWORD_MANAGER_ADDRESS}><Button as="a">View contract on PolygonScan</Button></Link>
    </>
          <Button onClick={startDownload} isDisabled={isDownloading}>
            Start Download
          </Button>
          {isDownloading && (
            <div>
              <Progress value={downloadProgress*100} />
              <Button onClick={cancelDownload}>Cancel Download</Button>
            </div>
          )}
        </div>
      )}
      
<Box bg="gray.200" p={4} rounded="lg" mt={4}>
  <Text fontSize="sm" color="gray.500">Disclaimer:</Text>
  <Text fontSize="sm" mt={2}>
  *Please be advised that this app is not audited and its security has not been independently verified. By using this app, you understand that you are taking the responsibility to keep your passwords secure and accept the risk of potential security breaches. We encourage users to thoroughly review the app{"'"}s source code to ensure its safety before use. You can view the source code <Link href="https://github.com/apenugon/eth_warden">here</Link>. Please proceed with caution and use this app at your own risk. </Text>
</Box>

  </Container>
    </>
  )
}
