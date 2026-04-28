import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {
  /**
   * Sends a payout allocation notification email.
   */
  static async sendPayoutNotification(
    to: string,
    maintainerAddress: string,
    amountXlm: string,
    orgName: string,
    unsubscribeToken: string
  ) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const unsubscribeUrl = `${baseUrl}/api/v1/notifications/unsubscribe?token=${unsubscribeToken}`;

    return resend.emails.send({
      from: 'Very-Princess <notifications@very-princess.io>',
      to,
      subject: `✨ New Payout: ${amountXlm} XLM allocated from ${orgName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h1 style="color: #7c3aed;">Hello Maintainer!</h1>
          <p>Great news! <strong>${orgName}</strong> has just allocated a new payout to your wallet on the Very-Princess registry.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <span style="font-size: 24px; font-weight: bold; color: #111827;">${amountXlm} XLM</span>
          </div>

          <p>You can claim your accumulated balance at any time by connecting your Freighter wallet to the dashboard.</p>
          
          <a href="${baseUrl}/payouts" style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Open Dashboard</a>
          
          <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;" />
          <p style="font-size: 12px; color: #6b7280; text-align: center;">
            Sent to ${maintainerAddress}. <br />
            <a href="${unsubscribeUrl}" style="color: #6b7280;">Unsubscribe from these notifications</a> or 
            hard-delete your data by visiting your Settings.
          </p>
        </div>
      `,
    });
  }
}