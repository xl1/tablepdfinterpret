export interface PDFPageViewport {
    width: number;
    height: number;
}

export interface PDFRenderImageLayer {
    beginLayout(): void;
    endLayout(): void;
    appendImage(): void;
}

export interface RenderParameters {
    canvasContext?: CanvasRenderingContext2D;
    viewport?: PDFPageViewport;
    intent?: 'display'|'print';
    enableWebGL?: boolean;
    renderInteractiveForms?: boolean;
    imageLayer?: PDFRenderImageLayer;
    canvasFactory?: any;
    background?: any;
}

export interface PDFRenderTask {
    promise: Promise<PDFPageProxy>;
    cancel(): void;
}

export interface TextContentItem {
    str: string;
    dir: string;
    transform: [number, number, number, number, number, number];
    width: number;
    height: number;
    fontName: string;
}

export interface TextStyle {
    ascent: number;
    descent: number;
    vertical: boolean;
    fontFamily: string;
}

export interface TextContent {
    items: TextContentItem[];
    styles: { [key: string]: TextStyle };
}

export interface PDFOperatorList {
    fnArray: number[];
    argsArray: any[];
}

export interface PDFPageProxy {
    pageNumber: number;
    getViewport(params?: { scale: number, rotate?: number, dontFlip?: boolean }): PDFPageViewport;
    getAnnotations(params?: { intent: 'display'|'print' }): Promise<any>;
    render(params: RenderParameters): PDFRenderTask;
    getTextContent(): Promise<TextContent>;
    getOperatorList(): Promise<PDFOperatorList>;
}

export interface PDFDocumentProxy {
    getPage(pageNumber: number): Promise<PDFPageProxy>;
}

interface PDFWorker {
}

interface PDFDataRangeTransport {
}

export interface DocumentInitParameters {
    url: string;
    data: Uint8Array|string;
    httpHeaders: { [key: string]: any };
    withCredentials: boolean;
    password: string;
    initialData: Uint8Array;
    length: number;
    range: PDFDataRangeTransport;
    rangeChunkSize: number;
    worker: PDFWorker;
    postMessageTransfers: boolean;
    verbosity: number;
    docBaseUrl: string;
    nativeImageDecoderSupport: string;
    cMapUrl: string;
    cMapPacked: boolean;
    CMapReaderFactory: any;
    stopAtErrors: boolean;
    maxImageSize: number;
    isEvalSupported: boolean;
    disableFontFace: boolean;
    disableRange: boolean;
    disableStream: boolean;
    disableAutoFetch: boolean;
    disableCreateObjectURL: boolean;
    pdfBug: boolean;
}

export interface PDFDocumentLoadingTask<T> {
    promise: Promise<T>;
}

export interface WorkerOptions {
    workerPort: PDFWorker;
    workerSrc: string;
}

declare function getDocument(src: string|Uint8Array|DocumentInitParameters|PDFDataRangeTransport): PDFDocumentLoadingTask<PDFDocumentProxy>;
declare const GlobalWorkerOptions: WorkerOptions;
