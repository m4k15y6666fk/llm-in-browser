
class _Database {
    constructor({ name = 'DefaultIndexedDB' }) {
        this.name = name;
        this.db = null;
    }

    init(blocked_callback = null) {
        return new Promise((resolve, reject) => {
            // Open a database
            const request = window.indexedDB.open(this.name, 1);

            request.onblocked = _ => {
                // 他のタブがデータベースを読み込んでいる場合は、処理を進める前に
                // それらを閉じなければなりません。
                try {
                    blocked_callback()
                } catch(e) {
                    console.error('database: blocked');
                    console.error(e);
                    alert("Close other tabs.");
                }
            };

            request.onerror = (event) => {
                // このデータベースのリクエストに対するすべてのエラー用の
                // 汎用エラーハンドラー
                console.error('database: error');
                reject(new Error(`Database error: ${event.target.errorCode}`));
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('database: upgradeneeded');

                // Changed by script
                if (! db.objectStoreNames.contains('Histroy')) {
                    db.createObjectStore('History', { keyPath: 'id', autoIncrement: true });
                }
    
                /*
                if (! db.objectStoreNames.contains('Settings')) {
                    db.createObjectStore('Settings');
                }
                */

                // 別のページがバージョン変更を求めた場合に、通知されるようにするためのハンドラーを追加するようにしてください。
                // データベースを閉じなければなりません。データベースを閉じると、別のページがデータベースをアップグレードできます。
                // これを行わなければ、ユーザーがタブを閉じるまでデータベースはアップグレードされません。
                db.onversionchange = _ => {
                    db.close();
                    window.location.reload();
                };
            };
            request.onsuccess = (event) => {
                const db = event.target.result;
                console.log('database: success');

                if (! db.onversionchange) {
                    db.onversionchange = _ => {
                        db.close();
                        window.location.reload();
                    };
                }

                this.db = db;
                resolve();
            };
        });
    }
}

export class Database extends _Database {
    constructor(x) {
        super(x);
    }

    removeObject(id) {
        return new Promise((resolve, reject) => {
          const req = this.db.transaction(['History'], 'readwrite').objectStore('History').delete(id);
    
          req.onerror = () => {
            reject(new Error('can\'t get'));
          };
          req.onsuccess = (e) => {
            resolve();
          };
        });
    }

    removeAllObject() {
      return new Promise((resolve, reject) => {
        const req = this.db.transaction(['History'], 'readwrite').objectStore('History').clear();
  
        req.onerror = () => {
          reject(new Error('can\'t get'));
        };
        req.onsuccess = (e) => {
          resolve();
        };
      });
    }
    
    displayAllObjects(el) {
        const history_container = document.querySelector('#history-container');
        const history_template = document.querySelector('#history-template');

        return new Promise((resolve, reject) => {
          const req = this.db.transaction(['History'], 'readwrite').objectStore('History').openCursor(null, 'prev');
    
          req.onerror = () => {
            reject(new Error('can\'t get'));
          };
          req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const div = document.createElement('div');
              div.classList.add('block');

              const _history_template = history_template.content.cloneNode(true);
              const { content, id } = cursor.value;
    
              const _history_prompt = _history_template.querySelector('textarea[data-textarea="prompt"]');
              const _copy_button = _history_template.querySelector('button[data-button="copy"]');
              _history_prompt.value = content;
              _history_prompt.readOnly = true;
              _history_template.querySelector('button[data-button="remove"]')
                               .addEventListener('click', async _ => {
                                  el.removeChild(div);
                                  await this.removeObject(id);
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

              div.prepend(_history_template)
              el.prepend(div);

              cursor.continue();
            } else {
                resolve();
            }
          };
        });
    }
    
    /*
    addEmptyObject() {
        return new Promise((resolve, reject) => {
          const req = this.db.transaction(['History'], 'readwrite').objectStore('History').add({ content: '' });
    
          req.onerror = () => {
            reject(new Error('can\'t get'));
          };
          req.onsuccess = (e) => {
            resolve(e.target.result);
          };
        });
    };
    */

    addObject(str) {
        return new Promise((resolve, reject) => {
          const req = this.db.transaction(['History'], 'readwrite').objectStore('History').add({ content: str });
    
          req.onerror = () => {
            reject(new Error('can\'t get'));
          };
          req.onsuccess = (e) => {
            resolve(e.target.result);
          };
        });
    }
    
    updateLastObject(str) {
        return new Promise((resolve, reject) => {
          const req = this.db.transaction(['History'], 'readwrite').objectStore('History').openCursor(null, 'prev');
    
          req.onerror = () => {
            reject(new Error('can\'t get'));
          };
          req.onsuccess = (e) => {
            e.target.result.value.content = str;
            resolve();
          };
        });
    }
}
