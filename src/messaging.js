const { Client } = require('@stomp/stompjs');
const { Subject, from } = require('rxjs');
const WebSocket = require('ws');

Object.assign(global, { WebSocket });

const ACTIVEMQ_URL = process.env.ACTIVEMQ_URL || 'ws://localhost:61614/ws';

let stompClient = null;
const connectionStatus$ = new Subject();

function connect() {
    stompClient = new Client({
        brokerURL: ACTIVEMQ_URL,
        reconnectDelay: 5000,
        onConnect: () => {
            console.log('[messaging] Connected to ActiveMQ');
            connectionStatus$.next('connected');
        },
        onDisconnect: () => {
            console.log('[messaging] Disconnected from ActiveMQ');
            connectionStatus$.next('disconnected');
        },
        onStompError: (frame) => {
            console.error('[messaging] STOMP error:', frame.headers['message']);
        },
    });
    stompClient.activate();
}

function publishEvent(topic, payload) {
    return from(new Promise((resolve, reject) => {
        if (!stompClient || !stompClient.connected) {
            console.warn('[messaging] Not connected — skipping publish to', topic);
            resolve();
            return;
        }
        try {
            stompClient.publish({
                destination: topic,
                body: JSON.stringify(payload),
                headers: { 'content-type': 'application/json' },
            });
            resolve();
        } catch (err) {
            reject(err);
        }
    }));
}

module.exports = { connect, publishEvent, connectionStatus$ };
