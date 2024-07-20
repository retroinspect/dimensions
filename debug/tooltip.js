const port = chrome.runtime.connect({ name: "dimensions" });

port.onMessage.addListener(event => {
    switch (event.type) {
        case 'background -> browser':
            const data = event.data;
            console.log('browser received back: ', data);
            break;
    }
});

port.postMessage({
    type: 'do'
});

