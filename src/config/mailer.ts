import { readFileSync } from 'fs'
import nodemailer from 'nodemailer'
import { renderFile } from 'pug'


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
 * @param subject The email subject
 * @param email the email of the sender
 * @param body the email content
 * @returns bool
 */
export const mailer = async (subject: string, email: string, message: string, template: string = 'deliver') => {
    const text = readFileSync(`./templates/${template}.txt`)
    const tx = await transport.sendMail({
        subject: `[StaticMailer] - ${subject}`,
        replyTo: email,
        text,
        html: renderFile(`./templates/${template}.pug`, { 
            pretty: true,
            email,
            message,
            timestamp: new Date()
        }),
        to: 'info@staticmailer.com',
        from: {
            name: 'Static Mailer',
            address: 'no-reply@staticmailer.com'
        }
    })

    return true
}
