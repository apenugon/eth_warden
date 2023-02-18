import 'localforage';
import localforage from 'localforage';

export type DownloadMessage = {
    type: 'progress' | 'done' | 'error' | 'cancelled' | 'started';
    url?: string;
    progress?: number;
    data?: Uint8Array;
    error?: Error;
}

const abortController = new AbortController();
let isDownloading = false;

self.onmessage = async (event: MessageEvent<DownloadMessage>) => {

    switch (event.data.type) {
        case 'started':
            try {
                if (isDownloading)
                    throw new Error('Already downloading');
                isDownloading = true;
                const response = await fetch(event.data.url!, {
                  signal: abortController!.signal
                });
                if (!response.ok) {
                  throw new Error('Failed to download file');
                }
          
                const reader = response.body?.getReader();
                if (!reader) {
                  throw new Error('ReadableStream not supported');
                }
          
                if (response.headers == null) {
                  throw new Error('Response headers not supported');
                }
                // @ts-ignore
                const contentLength = +response.headers.get('content-length');
                console.log('contentLength', contentLength)
                let data = new Uint8Array(contentLength);
                const chunks: Uint8Array[] = [];
                let downloaded = 0;
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  for (let i = 0; i < value.length; i++) {
                    data[downloaded + i] = value[i];
                  }
                  downloaded += value.byteLength;
                  console.log('downloaded', downloaded)
                  let messageToSend = { type: 'progress', progress: downloaded / contentLength}
                  postMessage(messageToSend);
                }
                console.log("Data Length", data.length)
                // @ts-ignore
                //const downloadedData = new Uint8Array(chunks.reduce((acc, chunk) => [...acc, ...chunk], []));
                await localforage.setItem('circuit_final.zkey', data);
                const messageToSend = { type: 'done' }
                console.log("posting message");
                postMessage(messageToSend);
              } catch (nerror) {
                let error = nerror as Error;
                if (error.name === 'AbortError') {
                  console.log('Download cancelled');
                } else {
                  const messageToSend = { type: 'error', error }
                  postMessage(messageToSend);
                }
              } finally {
                isDownloading = false;
              }
              break;
        case 'cancelled':
            console.log("Download cancelled");
            abortController.abort();
        default: // cancel download
    }

    
}