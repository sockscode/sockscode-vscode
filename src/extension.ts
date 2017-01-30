'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { Disposable, ExtensionContext, window, commands, TextEditor, workspace, TextDocumentChangeEvent, Range } from 'vscode';
import * as socketio from 'socket.io-client';
import { SocketIoCodeService } from './service/SocketIoCodeService';

class SocksCodeController {
    private _socketIoCodeService: SocketIoCodeService;
    private _roomUuid: string;
    private _disposable: Disposable;
    /**
     * We store this value to ensure to not send a change code socket event 
     * if the text in change is the same as we've received in socket.
     */
    private _prevRemoteText: string;

    constructor() {
        this._socketIoCodeService = SocketIoCodeService.createInstance();
        this._socketIoCodeService.onCodeChange((data) => {
            const editor = window.activeTextEditor;
            if (!editor) {
                return;
            }
            editor.edit((editBuilder) => {
                //FIXME change this to actual change tracking
                //it will lesser load on server make things faster for big files!
                // this uglines is only for POC
                this._prevRemoteText = data.code;
                editBuilder.replace(new Range(0, 0, 99999, 0), data.code);
            });
        });
        this._socketIoCodeService.onCreateRoom((_roomUuid) => {
            this._roomUuid = _roomUuid;
            window.showInformationMessage(`Room created. Room uuid :${this._roomUuid}`);
        });
        //vscode event subscriptions
        let subscriptions: Disposable[] = [];
        window.onDidChangeActiveTextEditor(this._onDidChangeActiveTextEditor, this, subscriptions);
        workspace.onDidChangeTextDocument(this._onDidChangeTextDocument, this, subscriptions);
        // create a combined disposable from both event subscriptions
        this._disposable = Disposable.from(...subscriptions);
    }

    public createRoom() {
        this._socketIoCodeService.createRoom();
    }

    public joinRoom(roomUuid: string) {
        this._socketIoCodeService.joinRoom(roomUuid);
    }

    public disconnect() {
        this._socketIoCodeService.close();
    }

    public dispose() {
        this._socketIoCodeService.close();
    }

    private _onDidChangeActiveTextEditor() {
        this._onCodeChange();
    }


    private _onDidChangeTextDocument(textDocumentChangeEvent: TextDocumentChangeEvent) {
        //fixme?
        this._onCodeChange();
    }

    private showRoom() {
        window.showInformationMessage(`Your room uuid :${this._roomUuid}`);
    }

    private _onCodeChange() {
        const editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        const text = editor.document.getText();
        if (text === this._prevRemoteText) {
            this._prevRemoteText = null;
            return;
        }
        this._socketIoCodeService.changeCode(text);
    }
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {


    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "sockscode-vscode" is now active!');
    let socksCodeController: SocksCodeController;

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposableComands = [
        commands.registerCommand('sockscode.createRoom', () => {
            if (!socksCodeController) {
                socksCodeController = new SocksCodeController();
            }
            socksCodeController.createRoom();
        }),
        commands.registerCommand('sockscode.connect', () => {
            // The code you place here will be executed every time your command is executed
            // Display a message box to the user
            window.showInputBox({ prompt: 'Please proide roomUuid to connect to' })
                .then(roomUuid => {
                    if (!socksCodeController) {
                        socksCodeController = new SocksCodeController();
                    }
                    socksCodeController.joinRoom(roomUuid);
                });
        }),
        commands.registerCommand('sockscode.disconnect', () => {
            // The code you place here will be executed every time your command is executed
            // Display a message box to the user
            if (socksCodeController) {
                socksCodeController.disconnect();
                socksCodeController = null;
            }
            window.showInformationMessage('dicsonnected');
        })
    ];

    context.subscriptions.push(...disposableComands);
}

// this method is called when your extension is deactivated
export function deactivate() {
}