const response_loading_message = async (response :Response, id :number = 0) => {
  const total_length = Number(response.headers.get('Content-Length'));
  let progress_length = 0;
  const stream = response.body || new ReadableStream();
  // @ts-ignore
  for await (let chunk of stream) {
    progress_length += chunk.length;
    postMessage({
      event: 'load.progress',
      id,
      url: response.url,
      rate: progress_length * 100 / total_length,
    });
  }

  return;
};


const _loadBinaryResource = async (url: string, id: number = 0): Promise<Uint8Array> => {
  let cache: Cache | null = null;
  const window = self;

  // Try to find if the model data is cached in Web Worker memory.
  if (typeof window === 'undefined') {
    console.debug('`window` is not defined');
  } else if (window && window.caches) {
    cache = await window.caches.open('wllama_cache');
    const cachedResponse = await cache.match(url);

    if (cachedResponse) {
      const data = await cachedResponse.arrayBuffer();
      const byteArray = new Uint8Array(data);
      return byteArray;
    }
  }


  // Download model and store in cache
  let _promise :Uint8Array = new Uint8Array();
  try {
    const response = await fetch(url);
    await response_loading_message(response.clone(), id);

    const arrayBuffer = await response.arrayBuffer();
    _promise = new Uint8Array(arrayBuffer);
    if (cache) {
      await cache.put(url, new Response(arrayBuffer))
    };
  } catch(err) {
    throw err;
  }

  return _promise;
};

export const joinBuffers = (buffers: Uint8Array[]): Uint8Array => {
  const totalSize = buffers.reduce((acc, buf) => acc + buf.length, 0);
  const output = new Uint8Array(totalSize);
  output.set(buffers[0], 0);
  for (let i = 1; i < buffers.length; i++) {
    output.set(buffers[i], buffers[i - 1].length);
  }
  return output;
};

/**
 * Load a resource as byte array. If multiple URLs is given, we will assume that the resource is splitted into small files
 * @param url URL (or list of URLs) to resource
 */
export const loadBinaryResource = async (url: string | string[], nMaxParallel: number): Promise<Uint8Array | Uint8Array[]> => {
  const urls: string[] = Array.isArray(url)
    ? [...url] as string[]
    : [url as string];

  const tasks: {
    url: string,
    result: Uint8Array,
    started: boolean,
  }[] = urls.map(u => ({
    url: u,
    result: new Uint8Array(),
    started: false,
  }));

  // This is not multi-thread, but just a simple naming to borrow the idea
  const threads: Promise<void>[] = [];
  const runDownloadThread = async (id :number = 0) => {
    while (true) {
      const task = tasks.find(t => !t.started);
      if (!task) return;
      task.started = true;
      task.result = await _loadBinaryResource(task.url, id);
    }
  };
  for (let i = 0; i < nMaxParallel; i++) {
    threads.push(runDownloadThread(i));
  }
  // wait until all downloads finish
  await Promise.all(threads);

  postMessage({
    event: 'load.complete',
  });

  return tasks.length === 1
    ? tasks[0].result
    : tasks.map(r => r.result);
};

const textDecoder = new TextDecoder();

/**
 * Convert list of bytes (number) to text
 * @param buffer 
 * @returns a string
 */
export const bufToText = (buffer: Uint8Array): string => {
  return textDecoder.decode(buffer);
};

/**
 * Get default stdout/stderr config for wasm module
 */
export const getWModuleConfig = (pathConfig: { [filename: string]: string }) => {
  return {
    noInitialRun: true,
    print: function(text: any) {
      if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
      console.log(text);
    },
    printErr: function(text: any) {
      if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
      console.warn(text);
    },
    // @ts-ignore
    locateFile: function (filename: string, basePath: string) {
      const p = pathConfig[filename];
      console.log(`Loading "${filename}" from "${p}"`);
      return p;
    },
  };
}

export const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export const absoluteUrl = (relativePath: string) => new URL(relativePath, document.baseURI).href;

export const padDigits = (number: number, digits: number) => {
  return Array(Math.max(digits - String(number).length + 1, 0)).join('0') + number;
}

/**
 * Browser feature detection
 * Copied from https://unpkg.com/wasm-feature-detect?module (Apache License)
 */

/**
 * @returns true if browser support multi-threads
 */
export const isSupportMultiThread = () => (async e => {try {return "undefined" != typeof MessageChannel && new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)), WebAssembly.validate(e);} catch (e) {return !1;}})(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 5, 4, 1, 3, 1, 1, 10, 11, 1, 9, 0, 65, 0, 254, 16, 2, 0, 26, 11]));

/**
 * @returns true if browser support wasm "native" exception handler
 */
const isSupportExceptions = async () => WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 8, 1, 6, 0, 6, 64, 25, 11, 11]));

/**
 * @returns true if browser support wasm SIMD
 */
const isSupportSIMD = async () => WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));

/**
 * Throws an error if the environment is not compatible
 */
export const checkEnvironmentCompatible = async (): Promise<void> => {
  if (!(await isSupportExceptions())) {
    throw new Error('WebAssembly runtime does not support exception handling');
  }
  if (!(await isSupportSIMD())) {
    throw new Error('WebAssembly runtime does not support SIMD');
  }
};
