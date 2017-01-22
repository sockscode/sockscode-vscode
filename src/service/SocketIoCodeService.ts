import * as socketio from 'socket.io-client';
import { getSockscodeServerUrl } from '../config/Config';

export interface CodeChangeSocketData {
    username: string,
    code: string
}

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

    changeCode(code: string) {
        this._io.emit('code change', code);
    }

    createRoom() {
        this._io.emit('create room');
    }

    joinRoom(roomUuid: string) {
        this._io.emit('join room', roomUuid);
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

    onConnection(onConnectionFunc: (socket: typeof socketio.Socket) => void, onDisconnectFunc: (socket: typeof socketio.Socket) => void) {
        this._io.on('connect', (socket: typeof socketio.Socket) => {
            onConnectionFunc(socket);
            socket.on('disconnect', () => {
                onDisconnectFunc(socket);
            });
        });
    }
}