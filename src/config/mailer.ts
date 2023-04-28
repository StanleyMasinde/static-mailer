import { readFileSync } from 'fs'
import nodemailer from 'nodemailer'
import { renderFile } from 'pug'
import { EmailOptions } from '../types'


let mailerPort: number
let mailerSecure: boolean
if (process.env.MAILER_PORT) {
    mailerPort = +process.env.MAILER_PORT
} else {
    mailerPort = 1025
}
if (process.env.MAILER_SECURE && process.env.MAILER_SECURE == "true") {
    mailerSecure = true
} else {
    mailerSecure = false
}

const transport = nodemailer.createTransport({
    host: process.env.MAILER_HOST || "localhost",
    port: mailerPort,
    secure: mailerSecure,
    auth: {
        user: process.env.MAILER_USERNAME,
        pass: process.env.MAILER_PASSWORD,
    },
});

/**
 * Deliver a given email to the intended user
 * @param recipientEmail 
 * @param subject 
 * @param senderEmail 
 * @param message 
 * @param template 
 * @returns 
 */
export const fowardEmail = async (recipientEmail: string, subject: string, senderEmail: string, message: string, template: string = 'deliver') => {
    const timestamp =  new Date().toUTCString()
    const text = readFileSync(`./templates/${template}.txt`)
    .toString()
    .replaceAll('#{{ email }}', senderEmail)
    .replaceAll('#{{ message }}', message)
    .replaceAll('#{{ timestamp }}', timestamp)
    const tx = await transport.sendMail({
        subject: `[StaticMailer] - ${subject}`,
        replyTo: senderEmail,
        text,
        html: renderFile(`./templates/${template}.pug`, { 
            pretty: true,
            email: senderEmail,
            message,
            timestamp
        }),
        to: recipientEmail,
        from: {
            name: 'Static Mailer',
            address: 'no-reply@staticmailer.com'
        }
    })

    return true
}

/**
 * Send out an email
 * @param mailOptions 
 */
export const sendMail = async (mailOptions: EmailOptions) => {
    const text = readFileSync(`./templates/${mailOptions.template}.txt`)
    try {
        await transport.sendMail({
            subject: mailOptions.subject,
            text,
            html: renderFile(`./templates/${mailOptions.template}.pug`, { 
                pretty: true,
                data: mailOptions.data,
                appUrl: process.env.APP_URL || 'https://staticmailer.test'
            }),
            to: mailOptions.receipient,
            from: {
                name: 'Static Mailer',
                address: 'no-reply@staticmailer.com'
            }
        })
    } catch (error) {
        
    }
}
