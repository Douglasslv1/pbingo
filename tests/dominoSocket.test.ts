import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { io as connect, Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { DominoState } from '../src/modules/domino/domino.types';
import { initSocket } from '../src/websocket/socket';
import { registerTestUser, setCreditBalance } from './helpers';
import { app } from './testApp';

let server: Server;
let url: string;
const sockets: Socket[] = [];

beforeAll(async () => {
  server = createServer(app);
  initSocket(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  sockets.forEach((socket) => socket.disconnect());
  await new Promise((resolve) => server.close(resolve));
});

function open(token?: string): Promise<Socket> {
  const socket = connect(url, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

/** Guarda todos os eventos de domino recebidos por uma conexao. */
function collect(socket: Socket) {
  const received: Array<{ event: string; payload: { mySeat?: number; game?: { hand: unknown } } }> = [];
  socket.onAny((event, payload) => {
    if (event.startsWith('domino:')) received.push({ event, payload });
  });
  return received;
}

describe('WebSocket do domino', () => {
  it('recusa conexao com token invalido', async () => {
    await expect(open('token-falso')).rejects.toThrow(/inválido/);
  });

  it('cada jogador recebe apenas a propria mao; conexoes anonimas nao recebem nada do domino', async () => {
    const players = [];
    for (let i = 0; i < 4; i += 1) {
      const player = await registerTestUser();
      await setCreditBalance(player.user.id, 5);
      players.push(player);
    }

    const [aliceSocket, bobSocket, anonymous] = await Promise.all([
      open(players[0].token),
      open(players[1].token),
      open(),
    ]);
    const alice = collect(aliceSocket);
    const bob = collect(bobSocket);
    const stranger = collect(anonymous);

    let tableId = '';
    for (const player of players) {
      const res = await request(app)
        .post('/domino/queue')
        .set('Authorization', `Bearer ${player.token}`)
        .send({ mode: 'SIX_TILES', teamMode: 'INDIVIDUAL' });
      tableId = res.body.id;
    }

    await expect.poll(() => alice.some((e) => e.payload.game)).toBe(true);
    await expect.poll(() => bob.some((e) => e.payload.game)).toBe(true);

    const state = (await prisma.gameTable.findUniqueOrThrow({ where: { id: tableId } })).state as unknown as DominoState;
    const aliceView = alice.filter((e) => e.payload.game).at(-1)!.payload;
    const bobView = bob.filter((e) => e.payload.game).at(-1)!.payload;

    expect(aliceView.game!.hand).toEqual(state.hands[aliceView.mySeat!]);
    expect(bobView.game!.hand).toEqual(state.hands[bobView.mySeat!]);
    expect(aliceView.mySeat).not.toBe(bobView.mySeat);

    // Nenhuma mensagem para Alice contem a mao de outro jogador
    const others = state.hands.filter((_, seat) => seat !== aliceView.mySeat).map((hand) => JSON.stringify(hand));
    for (const { payload } of alice) {
      const text = JSON.stringify(payload);
      others.forEach((hand) => expect(text).not.toContain(hand));
    }

    expect(stranger).toHaveLength(0);
  });
});
