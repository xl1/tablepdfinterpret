import * as pdfjs from 'pdfjs-dist';
import pdftorect from '../src/index';
import xml from './xml';

const svg = xml(key => document.createElementNS('http://www.w3.org/2000/svg', key));
const html = xml(key => document.createElement(key));

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
const canv = document.getElementById('canv') as HTMLDivElement;
const tbody = document.getElementById('tbody') as HTMLTableSectionElement;

loadButton.addEventListener('click', async e => {
    e.preventDefault();
    if (!fileInput.files || !fileInput.files.length) return;

    const
        pageNum = +pageNumber.value,
        file = fileInput.files[0],
        ab = await convert.blobToArrayBufferAsync(file),
        pdf = await pdfjs.getDocument(new Uint8Array(ab)).promise,
        page = await pdf.getPage(pageNum),
        rects = await pdftorect(pdf, { pageNumber: pageNum }),
        view = page.getViewport(1),
        svgRoot = svg.svg({
            viewBox: `0 0 ${view.width} ${view.height}`,
            style: `width: ${view.width}px; height: ${view.height}px`
        });

    tbody.innerHTML = '';
    canv.innerHTML = '';
    canv.appendChild(svgRoot);

    for (let i = 0; i < rects.length; i++) {
        const
            r = rects[i],
            x = r.left,
            y = view.height - r.top,
            width = r.right - r.left,
            height = r.top - r.bottom,
            rect = svg.rect({
                x, y, width, height,
                stroke: `hsla(${i * 97 % 360}, 100%, 50%, 0.5)`,
                'stroke-width': 1,
                fill: 'transparent',
            }),
            tr = html.tr({}, [
                i,
                r.strings.join(' '),
                x,
                y,
                width,
                height,
            ].map(txt => html.td({}, [txt.toString()])));

        // color on hover
        tr.addEventListener('mouseenter', e => rect.setAttribute('fill', 'yellow'), false);
        tr.addEventListener('mouseleave', e => rect.setAttribute('fill', 'transparent'), false);

        svgRoot.appendChild(rect);
        tbody.appendChild(tr);
    }
}, false);
