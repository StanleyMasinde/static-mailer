import nodemailer from 'nodemailer'
let mailerPort: number
let mailerSecure: boolean
if (process.env.MAILER_PORT) {
    mailerPort = +process.env.MAILER_PORT
} else {
    mailerPort = 1025
}
if(process.env.MAILER_SECURE && process.env.MAILER_SECURE == "true") {
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
export const mailer = async (subject: string, email: string, message: string) => {
    const tx = await transport.sendMail({
        subject,
        replyTo: email,
        text: message,
        to: 'info@example.com',
        from: {
            name : 'Staticsend',
            address: 'no-reply@staticsend.com'
        }
    })

   return true
}
