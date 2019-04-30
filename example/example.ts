import * as pdfjs from 'pdfjs-dist';
import pdftorect from '../src/index';

pdfjs.GlobalWorkerOptions.workerSrc = './pdf.worker.js';

const convert = {
    blobToArrayBufferAsync(blob: Blob): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
    }
};

const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const pageNumber = document.getElementById('pageNumber') as HTMLInputElement;
const loadButton = document.getElementById('loadButton') as HTMLInputElement;
const canv = document.getElementById('canv') as HTMLCanvasElement;

loadButton.addEventListener('click', async e => {
    e.preventDefault();
    if (!fileInput.files || !fileInput.files.length) return;

    const
        pageNum = +pageNumber.value,
        file = fileInput.files[0],
        ab = await convert.blobToArrayBufferAsync(file),
        pdf = await pdfjs.getDocument(new Uint8Array(ab)).promise,
        rects = await pdftorect(pdf, { pageNumber: pageNum }),
        viewport = (await pdf.getPage(pageNum)).getViewport(1);

    canv.width = viewport.width;
    canv.height = viewport.height;
    const ctx = canv.getContext('2d')!;
    ctx.textBaseline = 'top';

    for (const rect of rects) {
        const
            x = rect.left,
            y = viewport.height - rect.top,
            w = rect.right - rect.left,
            h = rect.top - rect.bottom;
        ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)';
        ctx.rect(x, y, w, h);
        ctx.stroke();
        ctx.strokeStyle = 'black';
        ctx.strokeText(rect.strings.join(' '), x, y, w);
    }
}, false);
