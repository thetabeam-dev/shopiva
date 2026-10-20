import https from "https";
import type { IncomingMessage } from "http";
const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
import axios from "axios";

export default class paystackTools {


    static verifyPayment(ref: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.paystack.co',
                port: 443,
                path: `/transaction/verify/${ref}`,
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${SECRET_KEY}`
                }
            };

            https.request(options, res => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed);
                    } catch (error) {
                        reject(new Error('Failed to parse payment verification response'));
                    }
                });
            }).on('error', (error) => {
                console.error(error);
                reject(new Error('Payment verification error'));
            });
        });
    }

    static async createDVA(user: {
        email: string;
        firstName: string;
        lastName: string;
        phone: string;
    }): Promise<any> {

        const paystack = axios.create({
            baseURL: "https://api.paystack.co",
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                "Content-Type": "application/json",
            },
        });
        // 1. Create the Paystack customer
        const customerResponse = await paystack.post("/customer", {
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
            phone: user.phone,
        });

        const customerCode = customerResponse.data.data.customer_code;

        // 2. Assign a dedicated virtual account
        const accountResponse = await paystack.post("/dedicated_account", {
            customer: customerCode,
            preferred_bank: "titan-paystack",
        });

        return {
            customerCode,
            accountNumber: accountResponse.data.data.account_number,
            accountName: accountResponse.data.data.account_name,
            bankName: accountResponse.data.data.bank.name,
        };

    }

    static createDVAOnce(user: {
        email: string;
        firstName: string;
        lastName: string;
        phone: string;
    }): Promise<{
        customerCode: string;
        accountNumber: string;
        accountName: string;
        bankName: string;
    }> {
        const options: https.RequestOptions = {
            method: "POST",
            hostname: "api.paystack.co",
            path: "/dedicated_account/assign",
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                "Content-Type": "application/json",
            },
        };

        const postData = JSON.stringify({
            email: user.email,
            first_name: user.firstName,
            last_name: user.lastName,
            phone: user.phone,
            preferred_bank: "titan-paystack",
            country: "NG",
        });

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res: IncomingMessage) => {
                const chunks: Buffer[] = [];

                res.on("data", (chunk: Buffer | string) => {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                });

                res.on("end", () => {
                    const raw = Buffer.concat(chunks).toString();
                    let parsed: {
                        status?: boolean;
                        message?: string;
                    };
                    try {
                        parsed = JSON.parse(raw) as typeof parsed;
                    } catch {
                        reject(new Error("Failed to parse dedicated account response"));
                        return;
                    }

                    const statusCode = res.statusCode ?? 0;
                    if (statusCode < 200 || statusCode >= 300 || parsed.status === false) {
                        reject(new Error(parsed.message || raw || "Dedicated account request failed"));
                        return;
                    }

                    if (parsed.status !== true) {
                        reject(new Error(parsed.message || "Dedicated account request failed"));
                        return;
                    }

                    const customerOptions: https.RequestOptions = {
                        hostname: "api.paystack.co",
                        port: 443,
                        path: `/customer/${encodeURIComponent(user.email)}`,
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                        },
                    };

                    const customerReq = https.request(customerOptions, (customerRes: IncomingMessage) => {
                        const customerChunks: Buffer[] = [];

                        customerRes.on("data", (chunk: Buffer | string) => {
                            customerChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                        });

                        customerRes.on("end", () => {
                            const customerRaw = Buffer.concat(customerChunks).toString();
                            let customerParsed: {
                                status?: boolean;
                                message?: string;
                                data?: {
                                    customer_code?: string;
                                    dedicated_account?: {
                                        account_number?: string;
                                        account_name?: string;
                                        bank?: { name?: string };
                                    } | null;
                                };
                            };
                            try {
                                customerParsed = JSON.parse(customerRaw) as typeof customerParsed;
                            } catch {
                                reject(new Error("Failed to parse Paystack customer response"));
                                return;
                            }

                            const customerStatus = customerRes.statusCode ?? 0;
                            if (customerStatus < 200 || customerStatus >= 300 || customerParsed.status === false) {
                                reject(new Error(customerParsed.message || customerRaw || "Could not load Paystack customer"));
                                return;
                            }

                            const customer = customerParsed.data;
                            const account = customer?.dedicated_account;
                            const customerCode = customer?.customer_code ?? "";
                            const accountNumber = account?.account_number ?? "";
                            const accountName = account?.account_name ?? "";
                            const bankName = account?.bank?.name ?? "";

                            if (!customerCode || !accountNumber) {
                                reject(new Error(customerParsed.message || "Paystack customer has no dedicated account yet"));
                                return;
                            }

                            resolve({
                                customerCode,
                                accountNumber,
                                accountName,
                                bankName,
                            });
                        });

                        customerRes.on("error", (error: Error) => {
                            reject(error);
                        });
                    });

                    customerReq.on("error", (error: Error) => {
                        reject(error);
                    });
                    customerReq.end();
                });

                res.on("error", (error: Error) => {
                    reject(error);
                });
            });

            req.on("error", (error: Error) => {
                reject(error);
            });

            req.write(postData);
            req.end();
        });
    }
}