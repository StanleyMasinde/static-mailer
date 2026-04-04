import { readFileSync } from 'fs'
import nodemailer from 'nodemailer'
import { renderFile } from 'pug'
import { EmailOptions } from '../types.js'


const {
	MAILER_PORT = '1025',
	MAILER_SECURE = 'false',
	MAILER_HOST = 'localhost',
	MAILER_USERNAME,
	MAILER_PASSWORD,
} = process.env

function escapeRegex(input: string) {
	return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const transport = nodemailer.createTransport({
	host: MAILER_HOST,
	port: parseInt(MAILER_PORT),
	secure: MAILER_SECURE === 'true',
	auth: {
		user: MAILER_USERNAME,
		pass: MAILER_PASSWORD,
	},
})

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
	const timestamp = new Date().toUTCString()
	const text = readFileSync(`./templates/${template}.txt`)
		.toString()
		.replace(/#{{ email }}/g, senderEmail)
		.replace(/#{{ message }}/g, message)
		.replace(/#{{ timestamp }}/g, timestamp)
	await transport.sendMail({
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
	const text = readFileSync(`./templates/${mailOptions.template}.txt`).toString('utf8')
	let subsititutedText: string = text

	for (const item in mailOptions.data) {
		const itemSub = mailOptions.data[item]
		const escapedItem = escapeRegex(item)
		const doubleBraceRegex = new RegExp(`\\{\\{\\s*${escapedItem}\\s*\\}\\}`, 'g')
		const singleBraceRegex = new RegExp(`\\{\\s*${escapedItem}\\s*\\}`, 'g')
		subsititutedText = subsititutedText
			.replace(doubleBraceRegex, itemSub.toString())
			.replace(singleBraceRegex, itemSub.toString())
	}

	
	await transport.sendMail({
		subject: mailOptions.subject,
		text: subsititutedText,
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
}
