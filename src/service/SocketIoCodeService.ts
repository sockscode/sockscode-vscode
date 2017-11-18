import * as socketio from 'socket.io-client';
import { getSockscodeServerUrl } from '../config/Config';
import { TreeFile } from '../common';

export interface CodeChangeSocketData {
    username: string,
    change: CodeChangePartialSocketData
}

export interface CodeChangePartialSocketData { code: string, filePath: string[] }
export interface LoadFileSocketData { filePath: string[] }

export class SocketIoCodeService {
    private static _instance: SocketIoCodeService = null;

    public static createInstance(): SocketIoCodeService {
        this._instance = new SocketIoCodeService(getSockscodeServerUrl());
        return this._instance;
    }

    private _io: typeof socketio.Socket;

    constructor(path: string) {
        this._io = socketio.connect(path, { path: '/code' });
        this._io.on('error', () => {
            //fixme
            console.log(`socket.io error ${JSON.stringify(arguments)}`);
        });
        this._io.on('connect_error', () => {
            //fixme
            console.log(`socket.io error connect_error ${JSON.stringify(arguments)}`);
        });
        this._io.on('connect_timeout', () => {
            //fixme
            console.log(`socket.io error connect_timeout ${JSON.stringify(arguments)}`);
        });
        this._io.on('connect', () => {
            //fixme
            console.log(`socket.io connect ${JSON.stringify(arguments)}`);
        });
    }

    close() {
        this._io.close();
    }

    changeCode(codeChangePartialSocketData: CodeChangePartialSocketData) {
        this._io.emit('code change', codeChangePartialSocketData);
    }

    createRoom() {
        this._io.emit('create room');
    }

    joinRoom(roomUuid: string) {
        this._io.emit('join room', roomUuid);
    }

    sendFilesStructure(files: TreeFile[]) {
        this._io.emit('files structure', { children: files });
    }

    requestFilesStructure() {
        this._io.emit('request files structure');
    }

    loadFile(loadFile: LoadFileSocketData) {
        this._io.emit('load file', loadFile);
    }

    onJoinedRoom(joinedRoomFunc: (roomUuid: string) => void) {
        this._io.on('joined room', (roomUuid: string) => {
            joinedRoomFunc(roomUuid);
        })
    }

    onCodeChange(codeChangeFunc: (data: CodeChangeSocketData) => void) {
        this._io.on('code change', (data: CodeChangeSocketData) => {
            codeChangeFunc(data);
        });
    }

    onCreateRoom(roomCreatedFunc: (roomUuid: string) => void) {
        this._io.on('create room', (roomUuid: string) => {
            roomCreatedFunc(roomUuid);
        })
    }

    onLoadFile(onLoadFileFunc: (loadFile: LoadFileSocketData) => void) {
        this._io.on('load file', (loadFile: LoadFileSocketData) => {
            onLoadFileFunc(loadFile);
        })
    }

    onFilesStructureRequest(onFilesStructureRequest: () => void) {
        this._io.on('request files structure', () => {
            onFilesStructureRequest();
        })
    }

    onFilesStructure(onFilesStructureRequest: (files: { children: TreeFile[] }) => void) {
        this._io.on('files structure', (files: { children: TreeFile[] }) => {
            onFilesStructureRequest(files);
        })
    }

    onConnection(onConnectionFunc: () => void, onDisconnectFunc: () => void) {
        this._io.on('connect', () => {
            onConnectionFunc();

        });
        this._io.on('disconnect', () => {
            onDisconnectFunc();
        });
    }
}
