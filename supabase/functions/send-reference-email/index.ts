import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReferenceEmailRequest {
  applicantName: string;
  applicantAddress: string;
  applicantPostcode: string;
  positionAppliedFor: string;
  referenceEmail: string;
  referenceName: string;
  referenceCompany?: string;
  referenceAddress?: string;
  companyName?: string;
  referenceType: 'employer' | 'character';
  applicationId: string;
  referenceData: any;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      applicantName,
      applicantAddress,
      applicantPostcode,
      positionAppliedFor,
      referenceEmail,
      referenceName,
      referenceCompany,
      referenceAddress,
      companyName,
      referenceType,
      applicationId,
      referenceData
    }: ReferenceEmailRequest = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate unique reference token
    const referenceToken = crypto.randomUUID();
    
    // Derive site origin from request for building public URL
    const siteOrigin = req.headers.get("origin") || `${new URL(req.url).protocol}//${new URL(req.url).host}`;
    const safeCompanyName = companyName && companyName.trim().length > 0 ? companyName : 'Your Company Name';
    const referenceLink = `${siteOrigin}/reference?token=${referenceToken}`;

    // Store reference request in database
    const { error: dbError } = await supabase
      .from('reference_requests')
      .insert({
        reference_token: referenceToken,
        applicant_name: applicantName,
        applicant_address: applicantAddress,
        applicant_postcode: applicantPostcode,
        position_applied_for: positionAppliedFor,
        reference_email: referenceEmail,
        reference_name: referenceName,
        reference_company: referenceCompany,
        reference_address: referenceAddress,
        company_name: safeCompanyName,
        reference_type: referenceType,
        application_id: applicationId,
        reference_data: referenceData,
        status: 'sent',
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
      });

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error(`Failed to create reference request: ${dbError.message}`);
    }

    console.log("Sending reference email to:", referenceEmail, "for applicant:", applicantName);

    // Create email content based on reference type
    const isEmployerReference = referenceType === 'employer';
    const subject = isEmployerReference
      ? `Request for Employer Reference for ${applicantName}`
      : `Request for Character Reference for ${applicantName}`;

    const emailHtml = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${subject}</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;margin:0;padding:0}
      .container{max-width:640px;margin:0 auto;background:#fff}
      .content{padding:32px}
      .btn{display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600}
      .footer{background:#f3f4f6;padding:20px;text-align:center;color:#6b7280;font-size:12px}
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p style="margin:0 0 16px 0;">Dear ${referenceName},</p>
        <p style="margin:0 0 16px 0;">I hope this message finds you well.</p>
        
        ${isEmployerReference ? `
        <p style="margin:0 0 16px 0;">
          ${applicantName} has applied for the position of ${positionAppliedFor} at ${safeCompanyName} and listed you as a previous employer. As part of our recruitment process, we would appreciate it if you could provide an employment reference regarding ${applicantName.split(' ')[0]}'s time at ${referenceCompany || 'your company'}.
        </p>
        ` : `
        <p style="margin:0 0 16px 0;">
          ${applicantName} has applied for the position of ${positionAppliedFor} at ${safeCompanyName} and has listed you as a character reference. We would appreciate it if you could provide your perspective on ${applicantName.split(' ')[0]}'s personal qualities, integrity, reliability, and overall character.
        </p>
        `}
        
        <p style="margin:0 0 16px 0;">To provide your reference, please click the link below and complete the short form:</p>
        <p style="margin:0 0 24px 0;">
          <a href="${referenceLink}" class="btn">👉 Provide Reference</a>
        </p>
        <p style="margin:0 0 8px 0; color:#6b7280; font-size:12px;">
          If the button does not work, copy and paste this URL into your browser:
        </p>
        <p style="word-break:break-all; color:#374151; font-size:12px;">${referenceLink}</p>
        
        <p style="margin:24px 0 16px 0;">
          Your ${isEmployerReference ? 'input' : 'feedback'} will be treated confidentially and will ${isEmployerReference ? 'greatly assist us in making an informed hiring decision' : 'play a valuable role in helping us make an informed hiring decision'}.
        </p>
        
        ${isEmployerReference ? `
        <p style="margin:0 0 16px 0;">Should you prefer to speak directly, please don't hesitate to reach out.</p>
        ` : `
        <p style="margin:0 0 16px 0;">If you have any questions or prefer to speak with us directly, feel free to contact me at your convenience.</p>
        `}
        
        <p style="margin:24px 0 0 0;">
          Thank you ${isEmployerReference ? 'in advance for your time and support' : 'very much for your time and assistance'}.
        </p>
        <p style="margin:16px 0 0 0;">
          Best regards,<br/>
          Yusuf<br/>
          Hr<br/>
          ${safeCompanyName}
        </p>
      </div>
      <div class="footer">
        <p style="margin:0;">This link is unique to you and will expire once used. Please do not share it.</p>
      </div>
    </div>
  </body>
</html>
`;

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) {
      throw new Error("BREVO_API_KEY environment variable is not set");
    }

    const payload = {
      sender: { name: "HR Department", email: "yuadm3@gmail.com" },
      replyTo: { name: "HR Department", email: "yuadm3@gmail.com" },
      to: [{ email: referenceEmail, name: referenceName }],
      subject: subject,
      htmlContent: emailHtml,
    };

    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Brevo API error response:", errorText);
      throw new Error(`Brevo API error: ${emailResponse.status} - ${errorText}`);
    }

    const result = await emailResponse.json();

    console.log("Reference email sent successfully:", result);

    return new Response(JSON.stringify({ 
      success: true,
      provider: "brevo",
      messageId: result?.messageId ?? null,
      referenceLink,
      referenceToken
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-reference-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);