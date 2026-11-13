import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayInit, SubscribeMessage, WebSocketGateway, ConnectedSocket } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { JwtPayloadInterface } from 'src/auth/interfaces/jwt-payload.interface';
import { Tenant } from 'src/common/tenancy/tenant-context';
import { OrganizationMemberRoleEnum } from 'src/organizations/enums/organization-member-role.enum';
import { OrganizationAccessService } from 'src/organizations/organization-access.service';
import { ChatBroadcaster, groupRoom, userRoom } from './chat-broadcaster';
import { ChatGroupsService } from './chat-groups.service';

const clientOrigin = process.env.CLIENT_ORIGIN ?? true;

type Member = Pick<Tenant, 'organizationId' | 'memberRole'>;

/**
 * The chat socket (design §6.2, namespace `/chat`): a signed-in member of an organisation
 * (token in the handshake, organisation from the token, membership checked) joins their own
 * room and the rooms of their group chats, and receives `chat:message`, `chat:deleted` and
 * `chat:group`. Sending goes through the REST API, which checks every rule.
 */
@WebSocketGateway({ namespace: '/chat', cors: { origin: clientOrigin, methods: ['GET', 'POST'], credentials: true } })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly groups: ChatGroupsService,
    private readonly access: OrganizationAccessService,
    private readonly broadcaster: ChatBroadcaster,
  ) {}

  afterInit(namespace: Namespace): void {
    this.broadcaster.attach(namespace);
  }

  async handleConnection(client: Socket): Promise<void> {
    const tenant = await this.tenantOf(client);
    if (!tenant) {
      client.emit('chat:error', { code: 'CHAT_UNAUTHORIZED' });
      client.disconnect(true);
      return;
    }
    client.data.userId = tenant.userId;
    client.data.tenant = tenant.tenant;
    await client.join(userRoom(tenant.userId));
    await this.joinGroups(client);
  }

  /** Joins the rooms of groups made since connecting (the web calls this after loading the list). */
  @SubscribeMessage('chat:subscribe')
  async subscribe(@ConnectedSocket() client: Socket): Promise<{ groups: number }> {
    if (!client.data.tenant) return { groups: 0 };
    return { groups: await this.joinGroups(client) };
  }

  private async joinGroups(client: Socket): Promise<number> {
    try {
      const ids = await this.groups.groupIdsOf(client.data.tenant as Member, client.data.userId as string);
      if (ids.length) await client.join(ids.map(groupRoom));
      return ids.length;
    } catch (err) {
      this.logger.warn(`Could not join chat rooms: ${(err as Error).message}`);
      return 0;
    }
  }

  private async tenantOf(client: Socket): Promise<{ userId: string; tenant: Member } | null> {
    const auth = client.handshake.auth as { token?: string } | undefined;
    const header = client.handshake.headers.authorization;
    const token = auth?.token ?? (header?.startsWith('Bearer ') ? header.slice(7) : null);
    if (!token) return null;
    let payload: JwtPayloadInterface;
    try {
      payload = this.jwtService.verify<JwtPayloadInterface>(token);
    } catch {
      return null;
    }
    if (payload.session_mode !== 'organization' || !payload.organization_id) return null;
    const membership = await this.access.getMembership(payload.organization_id, payload.id);
    if (!membership) return null;
    return {
      userId: payload.id,
      tenant: { organizationId: payload.organization_id, memberRole: membership.role as OrganizationMemberRoleEnum },
    };
  }
}
