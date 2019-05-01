type ElementFactory =
    (attrs?: { [key: string]: any }, children?: (Node|string)[]) => Element;

export default function (createElement: (key: string) => Element) {
    const obj: { [key: string]: ElementFactory } = {};
    return new Proxy(obj, {
        get(target, key: string): ElementFactory {
            return (attrs = {}, children = []) => {
                const node = createElement(key);
                for (const attr in attrs) {
                    node.setAttribute(attr, attrs[attr]);
                }
                node.append(...children);
                return node;
            };
        }
    });
};
