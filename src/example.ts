import fetch from 'node-fetch';
import convert from './index';

const url = 'https://gist.githubusercontent.com/xl1/8356b0df9630c91191cd8886604fbecc/raw/test.pdf';

async function main() {
    const data = await fetch(url).then(r => r.arrayBuffer());
    const rects = await convert(new Uint8Array(data));
    for (const rect of rects) {
        if (rect.strings.length) {
            console.log(rect.left, rect.bottom, rect.right, rect.top, ...rect.strings);
        }
    }
}

main().catch(console.error);
