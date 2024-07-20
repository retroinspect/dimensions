var debug = false;
var tabs = {};

function toggle(tab) {
  if (!tabs[tab.id])
    addTab(tab);
  else
    deactivateTab(tab.id);
}

function addTab(tab) {
  tabs[tab.id] = Object.create(dimensions);
  tabs[tab.id].activate(tab);
}

function deactivateTab(id) {
  tabs[id].deactivate();
}

function removeTab(id) {
  for (var tabId in tabs) {
    if (tabId == id)
      delete tabs[tabId];
  }
}

var lastBrowserAction = null;

chrome.browserAction.onClicked.addListener(function (tab) {
  if (lastBrowserAction && Date.now() - lastBrowserAction < 10) {
    // fix bug in Chrome Version 49.0.2623.87
    // that triggers browserAction.onClicked twice 
    // when called from shortcut _execute_browser_action
    return;
  }
  toggle(tab);
  lastBrowserAction = Date.now();
});

chrome.runtime.onConnect.addListener(function (port) {
  tabs[port.sender.tab.id].initialize(port);
});

chrome.runtime.onSuspend.addListener(function () {
  for (var tabId in tabs) {
    tabs[tabId].deactivate(true);
  }
});

var dimensions = {
  alive: true,

  activate: function (tab) {
    this.tab = tab;

    this.onBrowserDisconnectClosure = this.onBrowserDisconnect.bind(this);
    this.receiveBrowserMessageClosure = this.receiveBrowserMessage.bind(this);

    chrome.tabs.insertCSS(this.tab.id, { file: 'tooltip.css' });
    chrome.tabs.executeScript(this.tab.id, { file: 'tooltip.chrome.js' });
    chrome.browserAction.setIcon({
      tabId: this.tab.id,
      path: {
        16: "images/icon16_active.png",
        19: "images/icon19_active.png",
        32: "images/icon16_active@2x.png",
        38: "images/icon19_active@2x.png"
      }
    });

    this.worker = new Worker("dimensions.js");
    this.worker.onmessage = this.receiveWorkerMessage.bind(this);

    console.log('background -> worker: init');
    this.worker.postMessage({
      type: 'init',
      debug: debug
    });
  },

  deactivate: function (silent) {
    if (!this.port) {
      // not yet initialized
      this.alive = false;
      return;
    }

    if (!silent) {
      console.log('background -> browser: destroy');
      this.port.postMessage({ type: 'destroy' });
    }

    this.port.onMessage.removeListener(this.receiveBrowserMessageClosure);
    this.port.onDisconnect.removeListener(this.onBrowserDisconnectClosure);

    chrome.browserAction.setIcon({
      tabId: this.tab.id,
      path: {
        16: "images/icon16.png",
        19: "images/icon19.png",
        32: "images/icon16@2x.png",
        38: "images/icon19@2x.png"
      }
    });

    window.removeTab(this.tab.id);
  },

  onBrowserDisconnect: function () {
    this.deactivate(true);
  },

  initialize: function (port) {
    this.port = port;

    if (!this.alive) {
      // was deactivated whilest still booting up
      this.deactivate();
      return;
    }

    this.port.onMessage.addListener(this.receiveBrowserMessageClosure);
    this.port.onDisconnect.addListener(this.onBrowserDisconnectClosure);
    console.log('background -> browser: init');
    this.port.postMessage({
      type: 'init',
      debug: debug
    });
  },

  receiveWorkerMessage: function (event) {
    var forward = ['debug screen', 'distances', 'screenshot processed'];
    if (forward.indexOf(event.data.type) > -1) {
      this.port.postMessage(event.data);
      console.log(
        'worker -> background -> browser: ', event.data.type
      );

    }
  },

  receiveBrowserMessage: function (event) {
    var forward = ['position', 'area', 'imgBuffer'];

    if (forward.indexOf(event.type) > -1) {
      console.log(
        'browser -> background -> worker: ', event.type
      );
      this.worker.postMessage(event);
    } else {
      console.log(
        'browser -> background: ', event.type
      );

      switch (event.type) {
        case 'take screenshot':
          this.takeScreenshot();
          break;
        case 'close_overlay':
          this.deactivate();
          break;
      }
    }
  },

  takeScreenshot: function () {
    chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
      console.log('background -> browser: data');

      this.port.postMessage({
        type: 'data',
        data: {
          width: this.tab.width,
          height: this.tab.height,
          imgDataUrl: dataUrl,
        }
      });
    });
  }
};