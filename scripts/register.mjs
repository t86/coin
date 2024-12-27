import { ReadableStream, WritableStream, TransformStream } from 'web-streams-polyfill';
import { Blob } from 'buffer';
import { FormData, Headers, Request, Response, fetch } from 'undici';

// 设置全局变量
Object.assign(global, {
    ReadableStream,
    WritableStream,
    TransformStream,
    Blob,
    FormData,
    Headers,
    Request,
    Response,
    fetch
}); 