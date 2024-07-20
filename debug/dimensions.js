var data;

onmessage = (event) => {
    switch (event.data.type) {
        case 'browser -> background -> worker':
            data = event.data.data;
            console.log('worker received: ', data);

            postMessage({
                type: 'worker -> background -> browser',
                data
            });
            break;
    }
};
