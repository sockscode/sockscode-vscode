'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { Disposable, ExtensionContext, window, commands, TextEditor, workspace, TextDocumentChangeEvent, Range, Uri, RelativePattern, TextDocument } from 'vscode';
import * as socketio from 'socket.io-client';
import { SocketIoCodeService } from './service/SocketIoCodeService';
import * as path from 'path';
import * as fs from 'fs';

import { TreeFile } from './common';

class SocksCodeController {
    private _socketIoCodeService: SocketIoCodeService;
    private _roomUuid: string;
    private _disposable: Disposable;
    /**
     * True if this editor is master editor(the editor that has started the session)
     */
    private _isMaster: boolean;
    /**
     * We store this value to ensure to not send a change code socket event 
     * if the text in change is the same as we've received in socket.
     */
    private _prevRemoteText: string;

    private _skipOnDidChangeActiveTextEditor = false;
    private _skipOnDidChangeTextDocument = false;

    constructor() {
        this._socketIoCodeService = SocketIoCodeService.createInstance();
        this._socketIoCodeService.onCodeChange(async (data) => {
            //FIXME cache maybe?
            const { filePath, code } = data.change;
            const files = await workspace.findFiles(new RelativePattern(workspace.rootPath, path.join.apply(path, filePath)));
            if (!files[0]) {
                // the file doesn't exist yet, let's create it and all folders in it's path
                let rootTreeFile: TreeFile = null;
                let currentTreeFile: TreeFile = null;
                filePath.forEach((pathPart, i) => {
                    const treeFile: TreeFile = filePath.length - 1 !== i ?
                        {
                            filename: pathPart,
                            isDirectory: true
                        } :
                        {
                            filename: pathPart,
                            isDirectory: false
                        };
                    if (rootTreeFile) {
                        rootTreeFile = treeFile;
                    }
                    if (currentTreeFile && currentTreeFile.isDirectory) {
                        currentTreeFile.children = [treeFile];
                    }
                    currentTreeFile = treeFile;
                });
                ensureFilesExist([rootTreeFile]);
            }
            const document = await workspace.openTextDocument(files[0] || path.join.apply(path, [workspace.rootPath].concat(filePath)));
            let editor = window.activeTextEditor;
            if (!editor || editor.document !== document) {
                editor = await window.showTextDocument(document);
            }

            editor.edit((editBuilder) => {
                //FIXME change this to actual change tracking
                //it will lesser load on server make things faster for big files!
                // this uglines is only for POC
                this._prevRemoteText = code;
                editBuilder.replace(new Range(0, 0, 99999, 0), code);
            });
        });
        this._socketIoCodeService.onCreateRoom((_roomUuid) => {
            this._roomUuid = _roomUuid;
            this._isMaster = true;
            window.showInformationMessage(`Room created. Room uuid: ${this._roomUuid}`);
        });
        this._socketIoCodeService.onLoadFile(async (loadFile) => {
            if (!this._isMaster) {
                console.log('onFileOpenRequest not a master', loadFile);
                return;
            }
            const { filePath } = loadFile;
            const files = await workspace.findFiles(new RelativePattern(workspace.rootPath, path.join.apply(path, filePath)));
            if (files[0]) {
                const document = await workspace.openTextDocument(files[0]);
                this._socketIoCodeService.changeCode({ filePath, code: document.getText() });
            }
        });
        this._socketIoCodeService.onFilesStructureRequest(async () => {
            console.log('onFilesStructureRequest');
            if (!this._isMaster) {
                console.log('onFilesStructureRequest not a master');
                return;
            }
            const filesStructure = await getFilesStructure();
            this._socketIoCodeService.sendFilesStructure(filesStructure);
        });
        this._socketIoCodeService.onJoinedRoom(async (roomUuid) => {
            this._roomUuid = roomUuid;
            this._isMaster = false;
            window.showInformationMessage(`Joined room. Room uuid: ${this._roomUuid}`);
            this._socketIoCodeService.requestFilesStructure();
        });
        this._socketIoCodeService.onFilesStructure(async (files) => {
            await ensureFilesExist(files.children);
            window.showInformationMessage(`Joined room. Room uuid: ${this._roomUuid}`);
        });

        //vscode event subscriptions
        let subscriptions: Disposable[] = [];
        window.onDidChangeActiveTextEditor(this._onDidChangeActiveTextEditor, this, subscriptions)
        workspace.onDidChangeTextDocument(this._onDidChangeTextDocument, this, subscriptions);
        // create a combined disposable from both event subscriptions
        this._disposable = Disposable.from(...subscriptions);
    }

    public createRoom() {
        this._socketIoCodeService.createRoom();
    }

    public joinRoom(roomUuid: string) {
        this._socketIoCodeService.joinRoom(roomUuid);
        this._isMaster = false;
    }

    public dispose() {
        this._socketIoCodeService.close();
        this._disposable.dispose();
    }

    private _onDidChangeActiveTextEditor(textEditor: TextEditor) {
        // change of active text editor triggers chageTextDocument event, that we don't want to trigger in this case.
        this._skipOnDidChangeTextDocument = true;
        if (!this._isMaster) {
            this._socketIoCodeService.loadFile({ filePath: fullPathToFilePath(textEditor.document.fileName) });
        }
    }

    private _onDidChangeTextDocument(textDocumentChangeEvent: TextDocumentChangeEvent) {
        //fixme?
        if (this._skipOnDidChangeTextDocument) {
            this._skipOnDidChangeTextDocument = false;
            return;
        }
        this._onCodeChange(textDocumentChangeEvent.document);
    }

    private showRoom() {
        window.showInformationMessage(`Your room uuid: ${this._roomUuid}`);
    }

    private _onCodeChange(textDocument: TextDocument) {
        if (!textDocument) {
            const editor = window.activeTextEditor;
            if (!editor) {
                return;
            }
            textDocument = editor.document;
        }

        const text = textDocument.getText();
        const filePath = textDocument.fileName;
        if (text === this._prevRemoteText) {
            this._prevRemoteText = null;
            return;
        }
        this._socketIoCodeService.changeCode({ code: text, filePath: fullPathToFilePath(filePath) });
    }
}

function fullPathToFilePath(filePath: string) {
    return filePath.replace(workspace.rootPath, '').split(path.sep).filter(Boolean)
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
    let socksCodeController: SocksCodeController;

    let disposableComands = [
        commands.registerCommand('sockscode.createRoom', () => {
            if (socksCodeController) {
                socksCodeController.dispose();
            }
            socksCodeController = new SocksCodeController();
            startWatchingFiles(socksCodeController);
            socksCodeController.createRoom();
        }),
        commands.registerCommand('sockscode.connect', () => {
            // The code you place here will be executed every time your command is executed
            // Display a message box to the user
            window.showInputBox({ prompt: 'Please provide room uuid to connect to' })
                .then(roomUuid => {
                    if (socksCodeController) {
                        socksCodeController.dispose();
                    }
                    socksCodeController = new SocksCodeController();
                    socksCodeController.joinRoom(roomUuid);
                });
        }),
        commands.registerCommand('sockscode.disconnect', () => {
            // The code you place here will be executed every time your command is executed
            // Display a message box to the user
            if (socksCodeController) {
                socksCodeController.dispose();
                socksCodeController = null;
            }
            window.showInformationMessage('Disconnected');
        })
    ];

    context.subscriptions.push(...disposableComands);
}

//#region filesystem

async function ensureFilesExist(files: TreeFile[]) {
    const promiseMkdir = (path: string) => {
        return new Promise<void>((res, rej) => {
            fs.mkdir(path, (err) => {
                res(); //fixme in case of error
            });
        });
    }

    const promiseCreateFile = (path: string) => {
        return new Promise<void>((res, rej) => {
            fs.writeFile(path, '', (err) => {
                res(); //fixme in case of error
            });
        });
    }

    const promises: Promise<void>[] = [];
    const ensureFileExist = (treeFile: TreeFile, pathPart: string[]) => {
        const pathPartC = pathPart.concat(treeFile.filename);
        if (treeFile.isDirectory) {
            promises.push(promiseMkdir(path.join.apply(path, pathPartC)));
            treeFile.children.forEach((treeFile) => {
                ensureFileExist(treeFile, pathPartC);
            });
        } else {
            promises.push(promiseCreateFile(path.join.apply(path, pathPartC)));
        }
    }

    files.forEach((treeFile) => {
        ensureFileExist(treeFile, [workspace.rootPath]);
    });

    return Promise.all(promises);
}

async function getFilesStructure() {
    const rootPath = workspace.rootPath;
    const files = await workspace.findFiles(new RelativePattern(workspace.rootPath, '/**/*'), null);
    const treeFiles: TreeFile[] = [];
    files.forEach((file) => {
        const filePath = getPathInWorkspace(file);
        const pathList = filePath.split(path.sep);
        let currentLevel = treeFiles;
        /**
         * FIXME ugly and slow 
         */
        pathList.forEach((pathPart, i, arr) => {
            if (arr.length - 1 === i) {
                currentLevel.push({
                    filename: pathPart,
                    isDirectory: false,
                    extension: path.extname(pathPart).substring(1) //'remove . before extesnion name'
                });
                return;
            }
            if (!pathPart) { //skipping empty pathes.
                return;
            }
            let dir = currentLevel.find((treeFile) => {
                return treeFile.isDirectory && treeFile.filename === pathPart;
            });
            if (!dir) {
                dir = {
                    filename: pathPart,
                    children: [],
                    isDirectory: true
                }
                currentLevel.push(dir);
            }
            currentLevel = dir.children;
        });
    })
    return treeFiles;
}

function getPathInWorkspace(uri: Uri) {
    const rootPath = workspace.rootPath;
    const pathInWorkspace = uri.fsPath.replace(rootPath, '');
    return pathInWorkspace;
}

function startWatchingFiles(socksCodeController: SocksCodeController) {
    /**
     * FIXME: DISPOSE
     */
    //const fileSystemWatcher = workspace.createFileSystemWatcher(new RelativePattern(workspace.rootPath, '/**/*'), false, true, false);
    //fileSystemWatcher.onDidDelete((uri) => {
    //    console.log('deleted', uri);
    //});
}

//#endregion filesystem

// this method is called when your extension is deactivated
export function deactivate() {
}
