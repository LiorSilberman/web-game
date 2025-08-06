import { io } from "socket.io-client";

const hostname = window.location.hostname;
export const socket = io(`http://${hostname}:3001`);
