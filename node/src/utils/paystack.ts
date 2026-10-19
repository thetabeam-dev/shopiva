import https from "https";
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
}