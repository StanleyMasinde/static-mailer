import nodemailer from 'nodemailer'
let mailerPort: number
if (process.env.MAILER_PORT) {
    mailerPort = +process.env.MAILER_PORT
} else {
    mailerPort = 1025
}

const transport = nodemailer.createTransport({
    host: process.env.MAILER_HOST || "localhost",
    port: mailerPort,
    secure: false,
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
