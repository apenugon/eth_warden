import Head from 'next/head'
import Image from 'next/image'
import { Inter } from '@next/font/google'
import styles from '../styles/Home.module.css'
import { Box, Button, FormControl, FormHelperText, FormLabel, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Text } from '@chakra-ui/react'
import witness_gen from '../circuits/cc_prove_decryption/prove_decryption_js/witness_calculator'
// @ts-ignore
import wasm_buffer from '../circuits/cc_prove_decryption/prove_decryption_js/prove_decryption.wasm';
import { read, readFileSync } from 'fs'
const snarkjs = require('snarkjs')
import testWitnessInput from '../circuits/cc_prove_decryption/input.json';
import dataUriToBuffer from 'data-uri-to-buffer'
import { connect } from '@wagmi/core'
import { InjectedConnector } from '@wagmi/core/connectors/injected'
import { SetStateAction, useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useContractRead, useProvider, usePrepareContractWrite, useContractWrite, useWaitForTransaction, goerli } from 'wagmi'
import password_manager_info from "../artifacts/src/passwordManager.sol/PasswordManager.json";
import { PasswordManager } from '../typechain-types'
import { decrypt, DecryptionOutput, getCalldataFromMessage } from '../utils/zkutils'
import { info } from 'console'
const password_manager_abi = password_manager_info.abi;

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

async function displayHash() {
  let wasmBuffer = await readRemoteFile(wasm_buffer);
  let calc = await witness_gen(wasmBuffer);
  console.log("Jere");
  console.log(testWitnessInput);
  const buff = await calc.calculateWitness(testWitnessInput, 0);
  console.log(buff);
  alert("Hello, world!");
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
modalSubtext.set(page.CREATE, "Please enter the account label, your username, and password. This frontend will encrypt the password using a hash of your master password and store it on the blockchain. We will also store the account name on the blockchain.");
modalSubtext.set(page.UPDATE, "Please enter your updated username and password. This frontend will encrypt the password using a hash of your master password and store it on the blockchain. We will also store the account name on the blockchain.");
modalSubtext.set(page.DELETE, "");
modalSubtext.set(page.LOADING, "Please wait while we load your data from the blockchain. This may take a few seconds.");
modalSubtext.set(page.LOGGED_OUT, "Please connect your wallet to continue.");

export default function Home() {
  const { address, isConnecting, isConnected, isDisconnected, connector: activeConnector  } = useAccount();
  const { connect, connectors, error, pendingConnector } = useConnect({
    chainId: goerli.id
  });
  const { disconnect } = useDisconnect();

  const { data, error: contractError, isLoading, isSuccess: contractIsSuccess, refetch }: 
    {data: any, error: Error | null, isLoading: boolean, isSuccess: boolean, refetch: any} = useContractRead({
    address: '0x625CF7F4D881DcE8831e062F806267506F8050A1',
    abi: password_manager_abi,
    functionName: 'fetchAllAccountInfo',
    overrides: { from: address },
    onSettled(data, error) {
      console.log('Settled read', { data, error })
    },
  });

  const [decryptedInfo, setDecryptedInfo] = useState<DecryptionOutput[]>([]);
  const [privateKey, setPrivateKey] = useState<string>("");
  const [infoToAddUpdate, setInfoToAddUpdate] = useState<DecryptionOutput>(new DecryptionOutput());
  const [params, setParams] = useState< [[string, string], [[string, string], [string, string]], [string, string], [string, string, string], string, string]>();
  const [readyToCall, setReadyToCall] = useState<boolean>(false);
  const [rawLabelToDelete, setRawLabelToDelete] = useState<string>("");


  let [pageState, setPageState] = useState<page>(isConnected ? page.PULL : page.LOGGED_OUT);
  const { config, error: writeError } = usePrepareContractWrite({
    address: '0x625CF7F4D881DcE8831e062F806267506F8050A1',
    abi: password_manager_abi,
    functionName: 'updateAccountInfo',
    args: params,
    enabled: readyToCall,
    onSettled(data, error) {
      console.log("Prepare write settled", data);
    },
  })

  const { config: deleteConfig, error: deleteError } = usePrepareContractWrite({
    address: '0x625CF7F4D881DcE8831e062F806267506F8050A1',
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
      await refetch();
      setPageState(page.PULL);
      setReadyToCall(false);
    }    
  })

  useEffect(() => {
    console.log("Data updated", data, isLoading, contractIsSuccess);
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
      const decrypted = await decrypt(data, privateKey, wasmBuffer);
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
 
    {connectors.map((connector) => (
        <Button
          hidden={isConnected || pageState != page.LOGGED_OUT}
          key={connector.id}
          onClick={() => { 
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
      onClick={() => { 
        disconnect()
        setPageState(page.LOGGED_OUT);
      }}
    >
      Disconnect
    </Button>
    { isConnected && <div>{address}</div>}
      { error && <div>{error.message}</div> }

      {isConnected && 
      (
      <>
    <Box>
    { decryptedInfo.length == 0 && pageState == page.VIEW && <div>No passwords stored! Try a different chain?</div>}
    {decryptedInfo.map((info) => (
        <Box key={info.rawLabel} my={2} p={2} shadow="md">
            <Text fontWeight="bold">{info.label}</Text>
            <Text>Username: {info.username}</Text>
            <Text>Password: {info.password}</Text>
            <Button onClick={() => handleUpdateButton(info)} disabled={pageState != page.VIEW}>
                Update
            </Button>
            <Button onClick={() => handleDeleteButton(info)} disabled={pageState != page.VIEW}>
                Delete
            </Button>
        </Box>
    ))}
    </Box>
    <Button onClick={() => setPageState(page.CREATE)} disabled={pageState != page.VIEW}>

    Create
    </Button>
    { contractError && <div>{contractError.message}</div> }

    <Modal isOpen={pageState != page.VIEW} onClose={() => setPageState(page.VIEW)}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{modalHeader.get(pageState)}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <p>{modalSubtext.get(pageState)}</p>
          { pageState != page.LOADING && pageState != page.DELETE &&
          <>
          <FormControl aria-autocomplete='none'>
            <FormLabel htmlFor="privateKey">Master Password</FormLabel>
            <Input type="password" id="privateKey" value={privateKey} onChange={event => setPrivateKey(event.target.value)} />
          </FormControl> 
          { (pageState == page.CREATE || pageState == page.UPDATE) && <>
          { pageState == page.CREATE && <div>Creating new saved password</div> }
          { pageState == page.UPDATE && <div>Updating password for {infoToAddUpdate.label}</div> }
          <FormControl aria-autocomplete='none'>{ pageState == page.CREATE && <>
              <FormLabel htmlFor="label">Label</FormLabel>
              <Input type="text" id="label" value={infoToAddUpdate.label} onChange={event => setInfoToAddUpdate({...infoToAddUpdate, label: event.target.value})} /> 
            </>}
            <FormLabel htmlFor="username">Username</FormLabel>
            <Input type="text" id="username" value={infoToAddUpdate.username} onChange={event => setInfoToAddUpdate({...infoToAddUpdate, username: event.target.value})} />
            <FormLabel htmlFor="password">Password</FormLabel>
            <Input type="text" id="password" value={infoToAddUpdate.password} onChange={event => setInfoToAddUpdate({...infoToAddUpdate, password: event.target.value})} />
          </FormControl> 
          </>
          }
          </>
          }
          { pageState == page.DELETE && <div>Are you sure you want to delete?</div> }
          { transactionLoading && <div>Transaction in progress, waiting for confirmation...</div> }
          { isLoading && <div>Reading latest accounts from chain...</div> }
        </ModalBody>
        <ModalFooter>
          <Button type="submit" onClick={() => handleSubmit()} disabled={pageState == page.LOADING}>
            Submit
          </Button>
          { pageState == page.LOADING && readyToCall &&
          <Button onClick={handleExecuteTx} disabled={transactionLoading}>Execute transaction</Button>
          }
        </ModalFooter>
      </ModalContent>
    </Modal></>)
    }

    </>
  )
}
