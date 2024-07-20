var tabs = {};

class Dimensions {
    constructor(tab) {
        this.tab = tab;

        chrome.scripting.executeScript(
            {
                target: { tabId: this.tab.id },
                files: ['tooltip.js']
            });
    }

    initialize(port) {
        this.port = port;
        this.port.onMessage.addListener(this.receiveBrowserMessage.bind(this));
    }

    do() {
        const data = "hello";
        console.log('background sended: ', data);

        this.port.postMessage({
            type: 'background -> browser',
            data
        });
    }

    receiveBrowserMessage(event) {
        switch (event.type) {
            case 'do':
                this.do();
                break;
        }
    }

}

chrome.action.onClicked.addListener((tab) => {
    tabs[tab.id] = new Dimensions(tab);
});

chrome.runtime.onConnect.addListener((port) => {
    tabs[port.sender.tab.id].initialize(port);
});
