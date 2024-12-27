import { ReadableStream, WritableStream, TransformStream } from 'web-streams-polyfill';
import { Blob } from 'buffer';
import { FormData, Headers, Request, Response, fetch } from 'undici';

// 设置所有需要的全局变量
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

// 确保这些变量在全局范围内可用
declare global {
    var ReadableStream: typeof ReadableStream;
    var WritableStream: typeof WritableStream;
    var TransformStream: typeof TransformStream;
    var Blob: typeof Blob;
    var FormData: typeof FormData;
    var Headers: typeof Headers;
    var Request: typeof Request;
    var Response: typeof Response;
} 