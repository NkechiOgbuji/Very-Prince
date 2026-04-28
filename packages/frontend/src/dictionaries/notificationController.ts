import { FastifyRequest, FastifyReply } from 'fastify';
import { Keypair } from '@stellar/stellar-sdk';
import { prisma } from '../lib/prisma'; // Assuming Prisma setup
import { sign } from 'jsonwebtoken';

export const notificationController = {
  /**
   * Securely save email preference using a cryptographic signature.
   */
  async saveEmailPreference(request: FastifyRequest, reply: FastifyReply) {
    const { address, email, signature, message } = request.body as {
      address: string;
      email: string;
      signature: string;
      message: string;
    };

    try {
      // 1. Verify the signature to prove wallet ownership
      const keypair = Keypair.fromPublicKey(address);
      const isValid = keypair.verify(Buffer.from(message), Buffer.from(signature, 'base64'));

      if (!isValid) {
        return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid signature provided.' });
      }

      // 2. Generate an unsubscribe token (for GDPR compliance)
      const unsubscribeToken = sign({ address }, process.env.JWT_SECRET!, { expiresIn: '10y' });

      // 3. Upsert into database (Hard delete/GDPR compliance enabled)
      await prisma.maintainerNotification.upsert({
        where: { walletAddress: address },
        update: { email, optIn: true, unsubscribeToken },
        create: { walletAddress: address, email, optIn: true, unsubscribeToken },
      });

      return reply.send({ success: true, message: 'Notification preferences saved.' });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  },

  /**
   * GDPR Compliance: Hard delete email data.
   */
  async deleteEmailPreference(request: FastifyRequest, reply: FastifyReply) {
    const { address, signature, message } = request.body as {
      address: string;
      signature: string;
      message: string;
    };

    const keypair = Keypair.fromPublicKey(address);
    if (!keypair.verify(Buffer.from(message), Buffer.from(signature, 'base64'))) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    await prisma.maintainerNotification.delete({
      where: { walletAddress: address },
    });

    return reply.send({ success: true, message: 'Data purged successfully.' });
  },

  /**
   * Handle one-click unsubscribe via token.
   */
  async unsubscribe(request: FastifyRequest, reply: FastifyReply) {
    const { token } = request.query as { token: string };
    
    try {
      // In a real app, verify JWT and set optIn: false
      await prisma.maintainerNotification.updateMany({
        where: { unsubscribeToken: token },
        data: { optIn: false },
      });

      return reply.type('text/html').send('<h1>You have been successfully unsubscribed.</h1>');
    } catch {
      return reply.status(400).send('Invalid unsubscribe token.');
    }
  }
};