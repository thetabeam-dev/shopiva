/**
 * BASE EMAIL TEMPLATE
 * 
 * Provides consistent styling for all emails.
 */

export function baseTemplate(content: string, previewText?: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Deedyte</title>
    ${previewText ? `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${previewText}</span>` : ""}
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .header {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            padding: 32px 24px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            color: #ffffff;
            font-size: 28px;
            font-weight: 700;
        }
        .content {
            padding: 32px 24px;
        }
        .button {
            display: inline-block;
            padding: 14px 32px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin: 16px 0;
        }
        .button:hover {
            opacity: 0.9;
        }
        .footer {
            padding: 24px;
            text-align: center;
            color: #666666;
            font-size: 14px;
            background-color: #f9fafb;
            border-top: 1px solid #e5e7eb;
        }
        .footer a {
            color: #6366f1;
            text-decoration: none;
        }
        h2 {
            color: #1f2937;
            font-size: 24px;
            margin-top: 0;
        }
        p {
            margin: 16px 0;
            color: #4b5563;
        }
        .code {
            background-color: #f3f4f6;
            padding: 16px 24px;
            border-radius: 8px;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: 4px;
            text-align: center;
            color: #6366f1;
            margin: 24px 0;
        }
        .divider {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 24px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Deedyte</h1>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Deedyte. All rights reserved.</p>
            <p>
                <a href="#">Privacy Policy</a> | 
                <a href="#">Terms of Service</a> | 
                <a href="#">Unsubscribe</a>
            </p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

