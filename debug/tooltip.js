const port = chrome.runtime.connect({ name: "dimensions" });

port.onMessage.addListener(event => {
    switch (event.type) {
        case 'worker -> background -> browser':
            const data = event.data;
            console.log('browser received back: ', data);
            break;

        case 'background -> browser':
            port.postMessage({
                type: 'browser -> background -> worker',
                data: event.data
            });
            break;
    }
});

port.postMessage({
    type: 'do'
});