import { Wllama } from './esm/index.js';

import { Database } from './db.js';
import { Clock } from './clock.js';

import { MODELS } from './models.js';
import { TEMPLATES } from './template.js';


const CONFIG_PATHS = {
    'single-thread/wllama.js'       : './esm/single-thread/wllama.js',
    'single-thread/wllama.wasm'     : './esm/single-thread/wllama.wasm',
    'multi-thread/wllama.js'        : './esm/multi-thread/wllama.js',
    'multi-thread/wllama.wasm'      : './esm/multi-thread/wllama.wasm',
    'multi-thread/wllama.worker.mjs': './esm/multi-thread/wllama.worker.mjs',
};
/*
const CMPL_MODEL = 'https://huggingface.co/ggml-org/models/resolve/main/tinyllamas/stories15M-q4_0.gguf';
const CMPL_MODEL_SIZE = '19MB';
*/
let CMPL_MODEL = MODELS[0].url;
/*
const CMPL_MODEL_SIZE = '234.8MB';
const EMBD_MODEL = 'https://huggingface.co/ggml-org/models/resolve/main/bert-bge-small/ggml-model-f16.gguf';
const EMBD_MODEL_SIZE = '67MB';
*/


/** DOM Elements */
const download = {
    _: document.querySelector('#download'),
    progress: document.querySelector('#download-progress'),
    text: document.querySelector('#download-text'),
    seconds: document.querySelector('#download-seconds'),
    percentage: document.querySelector('#download-percentage'),
};
const elem_generate = {
    _: document.querySelector('#generate'),
    progress: document.querySelector('#generate-progress'),
    text: document.querySelector('#generate-text'),
    seconds: document.querySelector('#generate-seconds'),
};
const elem_storage = {
    _: document.querySelector('#storage'),
    progress: document.querySelector('#storage-progress'),
    text: document.querySelector('#storage-text'),
    usage: document.querySelector('#storage-usage'),
    quota: document.querySelector('#storage-quota'),
};
const elem_model = {
    name: document.querySelector('#model-name'),
    size: document.querySelector('#model-size'),
    type: document.querySelector('#model-type'),
    repo: document.querySelector('#model-repo'),
    lang: document.querySelector('#model-lang'),
}
const elem_select_model = document.querySelector('#select-model');

const elem_select_template = document.querySelector('#select-template');

const copy_button = document.querySelector('#copy-button');


// Remove Storage
const remove_history_button = document.querySelector('#remove-history-button');
const remove_models_button = document.querySelector('#remove-models-button');
const remove_all_button = document.querySelector('#remove-all-button');

// History
const save_button = document.querySelector('#save-button');
const history_container = document.querySelector('#history-container');
const history_template = document.querySelector('#history-template');

// DOM elements: completions
//const elemCmplModel = document.getElementById('cmpl_model');
const elemBtnStartCmpl = document.getElementById('btn_start_cmpl');
//const elemInput = document.getElementById('input_prompt');
const elem_threads = document.querySelector('#input-threads');
const elem_temperature = document.querySelector('#input-temperature');
const elemNPredict = document.getElementById('input_n_predict');
const elemBtnCompletions = document.getElementById('btn_run_cmpl');
const prompt = document.getElementById('prompt');

/* DOM elements: embeddings
const elemEmbdModel = document.getElementById('embd_model');
const elemBtnStartEmbd = document.getElementById('btn_start_embd');
const elemInputA = document.getElementById('input_a');
const elemInputB = document.getElementById('input_b');
const elemBtnEmbeddings = document.getElementById('btn_run_embd');
const elemOutputEmbd = document.getElementById('output_embd');
*/

// utils
const setCmplDisable = (disabled) => {
    prompt.readOnly = disabled;

    elem_temperature.disabled = disabled;
    elemNPredict.disabled = disabled;
    elemBtnCompletions.disabled = disabled;

    copy_button.disabled = disabled;
    save_button.disabled = disabled;

    elem_select_template.disabled = disabled;

    //remove_history_button.disabled = disabled;
    remove_models_button.disabled = disabled;
    remove_all_button.disabled = disabled;

    if (elem_select_model.disabled) {
        disabled
        ? prompt.parentElement.classList.add('is-loading')
        : prompt.parentElement.classList.remove('is-loading');

        disabled
        ? elemBtnCompletions.classList.add('is-loading')
        : elemBtnCompletions.classList.remove('is-loading');
    }
};
/*
const setEmbdDisable = (disabled) => {
    elemInputA.disabled = disabled;
    elemInputB.disabled = disabled;
    elemBtnEmbeddings.disabled = disabled;
};
*/


copy_button.addEventListener('click', async _ => {
    try {
        await navigator.clipboard.writeText(prompt.value);
        copy_button.classList.add('is-primary');
    } catch (error) {
        console.error(error.message);
        copy_button.classList.add('is-dander');
    }

    setTimeout(_ => {
        copy_button.classList.remove('is-primary', 'is-danger');
    }, 2500);
});

document.querySelectorAll('[data-heading="true"]')
        .forEach((elem, idx) => {
            elem.textContent = (idx + 1) + '. ';
        });

document.querySelectorAll('option[value]')
        .forEach(elem => {
            elem.textContent = MODELS[elem.value].name;
        });

TEMPLATES.forEach((item, idx) => {
    elem_select_template.insertAdjacentHTML(
        'beforeend',
        '<option ' + (idx == 0 ? 'selected' : '') + ' value="' + idx + '">' + item.name + '</option>'
    );
});
elem_select_template.addEventListener('change', _ => {
    const _template = TEMPLATES[elem_select_template.value];

    prompt.value = _template.before + prompt.value + _template.after;
});

remove_models_button.addEventListener('click', async _ => {
    try {
        await window.caches.delete('wllama_cache');
        window.location.reload();
    } catch(err) {
        console.error(err);
    }
});


const update_model = _ => {
    const _model = MODELS[elem_select_model.value];

    CMPL_MODEL = MODELS[elem_select_model.value].url;

    elem_model.name.textContent = _model.name;
    elem_model.type.textContent = _model.type;
    elem_model.lang.textContent = _model.lang;
    elem_model.size.textContent = _model.size;

    elem_model.repo.textContent = _model.repo;
    elem_model.repo.href = _model.repo;
};
update_model();
elem_select_model.addEventListener('change', update_model);


const initialize_database = async _ => {
    const _database = new Database({ name: 'TextGenerateIndexedDB' });
    await _database.init(null);
  
    await _database.displayAllObjects(history_container);
  
    const save_history = async (value) => {
        const r = await _database.addObject(value);

        const div = document.createElement('div');
        div.classList.add('block');

        const _history_template = history_template.content.cloneNode(true);

        const _history_prompt = _history_template.querySelector('textarea[data-textarea="prompt"]');
        const _copy_button = _history_template.querySelector('button[data-button="copy"]');
        _history_prompt.value = value;
        _history_prompt.readOnly = true;
        _history_template.querySelector('button[data-button="remove"]')
                        .addEventListener('click', async _ => {
                            history_container.removeChild(div);
                            await _database.removeObject(r);
                        } ,{ once: true });
        _copy_button.addEventListener('click', async _ => {
            try {
                await navigator.clipboard.writeText(_history_prompt.value);
                _copy_button.classList.add('is-primary');
            } catch (error) {
                console.error(error.message);
                _copy_button.classList.add('is-dander');
            }

            setTimeout(_ => {
                _copy_button.classList.remove('is-primary', 'is-danger');
            }, 2500);
        });

        div.prepend(_history_template);
        history_container.prepend(div);
    };
  
    save_button.addEventListener('click', async _ => {
        await save_history(prompt.value);
    });

    remove_history_button.addEventListener('click', async _ => {
        try {
            await _database.removeAllObject();
            window.location.reload();
        } catch(err) {
            console.error(err);
        }
    });
    remove_all_button.addEventListener('click', async _ => {
        try {
            await window.caches.delete('wllama_cache');
            await _database.removeAllObject();
            window.location.reload();
        } catch(err) {
            console.error(err);
        }
    });
}

async function main() {
    setCmplDisable(true);
    //setEmbdDisable(true);
    //const getName = (url) => url.match(/\/resolve\/main(.*)/)[1];
    //elemCmplModel.textContent = `${getName(CMPL_MODEL)}, size: ${CMPL_MODEL_SIZE}`;
    //elemEmbdModel.textContent = `${getName(EMBD_MODEL)}, size: ${EMBD_MODEL_SIZE}`;

    await update_storage_estimate();
    await initialize_database();

    elemBtnStartCmpl.onclick = async () => {
        console.log(CMPL_MODEL);
        download._.style.display = '';
        elemBtnStartCmpl.disabled = true;
        elem_select_model.disabled = true;
        elem_select_template.disabled = true;
        elem_threads.disabled = true;

        await startCompletions(CMPL_MODEL);

        elemBtnStartCmpl.style.display = 'none';
        elemBtnCompletions.classList.add('is-link');
    };
    /*
    elemBtnStartEmbd.onclick = async () => {
    elemBtnStartEmbd.disabled = true;
    await startEmbeddings(EMBD_MODEL);
    elemBtnStartEmbd.style.display = 'none';
    };
    */
}

/////////////////////////////////////////////////////////////////////
// completions

let _clock = {};
async function startCompletions(modelUrl) {
    _clock = new Clock();
    const _threads = (elem_threads.value > navigator.hardwareConcurrency || elem_threads.value <= 0)
                     ? navigator.hardwareConcurrency
                     : Number(elem_threads.value);
    console.log('threads: ' + _threads);

    const wllama = new Wllama(CONFIG_PATHS);
    await wllama.loadModelFromUrl(modelUrl, { n_threads: _threads });
    await update_storage_estimate();
    setCmplDisable(false);

    remove_models_button.addEventListener('click', _ => {
        true;
    });

    elemBtnCompletions.onclick = async () => {
        elem_generate._.style.display = '';
        elem_generate.progress.value = 1;
        elem_generate.progress.classList.remove('is-primary');
        elem_generate.text.textContent = '準備中...';
        elem_generate.seconds.parentElement.style.display = '';
        elem_generate.seconds.value = 99;
        setTimeout(function _timer() {
            if (elem_generate.progress.value >= 100) {
                elem_generate.text.textContent = '準備完了';
                elem_generate.seconds.parentElement.style.display = 'none';
            } else {
                elem_generate.progress.value++;
                elem_generate.seconds.value--;
                _timer();
            }
        }, 1000);
        const _when_start_generate = _ => {
            elem_generate.progress.value = 100;
            elem_generate.progress.classList.add('is-primary');
        }

        const _temperature = (elem_temperature.value > 1 || elem_temperature.value < 0)
                         ? 0.5
                         : Number(elem_temperature.value);
        console.log('temperature: ' + _temperature);

        setCmplDisable(true);

        let _first = true;
        const user_text = prompt.value;
        await wllama.createCompletion(prompt.value, {
            nPredict: parseInt(elemNPredict.value),
            sampling: {
                temp: _temperature,
                top_k: 40,
                top_p: 0.9,
            },
            onNewToken: (token, piece, currentText) => {
            if (_first) {
                _when_start_generate();
                _first = false;
            }
            prompt.value = user_text + currentText;
            },
        });
        setCmplDisable(false);
    };
}

/////////////////////////////////////////////////////////////////////
/* embeddings

async function startEmbeddings(modelUrl) {
    const wllama1 = new Wllama(CONFIG_PATHS);
    await wllama1.loadModelFromUrl(modelUrl, {
    // IMPORTANT: do not forget to set embeddings to true. If not set, "createEmbedding" will crash the app
    embeddings: true,
    pooling_type: 'LLAMA_POOLING_TYPE_MEAN', // depend on the model, you will need to change this
    });
    setEmbdDisable(false);

    elemBtnEmbeddings.onclick = async () => {
    setEmbdDisable(true);
    const embdA = await wllama1.createEmbedding(elemInputA.value);
    console.log({embdA});
    const embdB = await wllama1.createEmbedding(elemInputB.value);
    console.log({embdB});
    // since embeddings are normalized, we don't need to calculate norm
    const dotProd = embdA.reduce((acc, _, i) => acc + embdA[i]*embdB[i], 0);
    elemOutputEmbd.textContent = dotProd;
    setEmbdDisable(false);
    };
}
*/

/////////////////////////////////////////////////////////////////////

const update_storage_estimate = async _ => {
    if (!navigator.storage.estimate) {
        elem_storage._.style.display = 'none';
        return;
    }

    const _format = num => {
        if (num > 1000 ** 4) {
            return (num / (1000 ** 4)).toFixed(2) + ' TB';
        } else if (num > 1000 ** 3) {
            return (num / (1000 ** 3)).toFixed(2) + ' GB';
        } else if (num > 1000 ** 2) {
            return (num / (1000 ** 2)).toFixed(2) + ' MB';
        } else if (num > 1000) {
            return (num / 1000).toFixed(2) + ' KB';
        } else if (num >= 0) {
            return num + ' B';
        }
    };

    const estimate = await navigator.storage.estimate();

    elem_storage.usage.textContent = _format(estimate.usage);
    elem_storage.quota.textContent = _format(estimate.quota);
    elem_storage.progress.value = estimate.usage * 100 / estimate.quota;

    if (elem_storage.progress.value >= 90) {
        elem_storage.progress.classList.add('is-danger');
    } else if (elem_storage.progress.value >= 50) {
        elem_storage.progress.classList.add('is-warning');
    } else {
        elem_storage.progress.classList.add('is-info');
    }

    return;
};

main();


let _list = new Map();
window.addEventListener('message', (msg) => {
    const { event } = msg.data;
    if (event == 'load.progress') {
        const { id, rate } = msg.data;
        _list.set(id, rate);

        let _progress = 0;
        for (let r of _list.values()) {
            _progress += r;
        }
        const percentage = (_progress / _list.size).toFixed(1);

        if (_clock.interval() >= 1000) {
            _clock.record();

            const seconds = (_clock.last() * (100 - percentage) / (percentage * 1000));
            download.seconds.textContent = Number.isFinite(seconds) ? seconds.toFixed(0) : "-";
        }

        //console.log(percentage);
        download.progress.value = percentage;
        download.percentage.textContent = percentage;

    } else if (event == 'load.complete') {
        console.log('model: loaded');

        // Exit when done
        download.text.textContent = "Loading completed.";
        download.progress.value = 100;
        download.percentage.textContent = 100;
        download.seconds.parentElement.style.visibility = 'hidden';
        download.progress.classList.add('is-primary');
    }
});
