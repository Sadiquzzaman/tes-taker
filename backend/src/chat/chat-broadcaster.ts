import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';

/** The chat socket rooms (design §6.2): a group chat's members, a private chat's two people, and each person's own sockets. */
export const groupRoom = (groupId: string) => `group:${groupId}`;
export const userRoom = (userId: string) => `user:${userId}`;
export const directRoom = (chatId: string) => `direct:${chatId}`;

/**
 * Sends chat events to sockets. The gateway hands over its namespace when it starts, so services
 * send without depending on the gateway; before that (and in jobs) nothing is sent.
 */
@Injectable()
export class ChatBroadcaster {
  private namespace: Namespace | null = null;

  attach(namespace: Namespace): void {
    this.namespace = namespace;
  }

  toGroup(groupId: string, event: string, payload: unknown): void {
    this.namespace?.to(groupRoom(groupId)).emit(event, payload);
  }

  toDirect(chatId: string, event: string, payload: unknown): void {
    this.namespace?.to(directRoom(chatId)).emit(event, payload);
  }

  toUsers(userIds: string[], event: string, payload: unknown): void {
    if (!this.namespace || userIds.length === 0) return;
    this.namespace.to(userIds.map(userRoom)).emit(event, payload);
  }

  /** Puts a person's sockets in a private chat's room (it was just started). */
  joinDirect(userId: string, chatId: string): void {
    this.namespace?.in(userRoom(userId)).socketsJoin(directRoom(chatId));
  }

  /** Puts a person's sockets in a group's room (they were added, or opened it). */
  joinGroup(userId: string, groupId: string): void {
    this.namespace?.in(userRoom(userId)).socketsJoin(groupRoom(groupId));
  }
}
