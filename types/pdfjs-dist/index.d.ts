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

export interface GetAnnotationParameters {
    intent?: 'display'|'print';
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

    getViewport(scale: number, rotate?: number, dontFlip?: boolean): PDFPageViewport;
    getAnnotations(params?: GetAnnotationParameters): Promise<any>;
    render(params: RenderParameters): PDFRenderTask;
    getTextContent(): Promise<TextContent>;
    getOperatorList(): Promise<PDFOperatorList>;
}

export interface PDFDocumentProxy {
    getPage(pageNumber: number): Promise<PDFPageProxy>;
}

export interface PDFDocumentLoadingTask<T> {
    promise: Promise<T>;
}

declare function getDocument(source: Uint8Array): PDFDocumentLoadingTask<PDFDocumentProxy>;
