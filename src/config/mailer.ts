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
	COMPANY_NAME = 'Static Mailer',
	COMPANY_URL,
	DASHBOARD_URL,
} = process.env

function getAppUrl() {
	const rawUrl = process.env.APP_URL || 'https://staticmailer.test'
	return rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl
}

function getCompanyUrl() {
	const appUrl = getAppUrl()
	const rawUrl = COMPANY_URL || appUrl
	return rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl
}

function getDashboardUrl() {
	const appUrl = getAppUrl()
	const rawUrl = DASHBOARD_URL || `${appUrl}/dashboard`
	return rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl
}

function getTemplateContext() {
	const appUrl = getAppUrl()
	const companyUrl = getCompanyUrl()
	const dashboardUrl = getDashboardUrl()
	return {
		appUrl,
		companyUrl,
		dashboardUrl
	}
}

function getBaseTemplateData() {
	const { appUrl, companyUrl, dashboardUrl } = getTemplateContext()
	return {
		app_url: appUrl,
		dashboard_url: dashboardUrl,
		company_name: COMPANY_NAME,
		company_url: companyUrl
	}
}

function escapeRegex(input: string) {
	return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function substituteTemplateTokens(templateText: string, data: Record<string, string | number | Date>) {
	let substitutedText = templateText
	for (const item in data) {
		const itemSub = data[item]
		const escapedItem = escapeRegex(item)
		const doubleBraceRegex = new RegExp(`\\{\\{\\s*${escapedItem}\\s*\\}\\}`, 'g')
		const singleBraceRegex = new RegExp(`\\{\\s*${escapedItem}\\s*\\}`, 'g')
		const squareBracketRegex = new RegExp(`\\[\\s*${escapedItem}\\s*\\]`, 'g')
		substitutedText = substitutedText
			.replace(doubleBraceRegex, itemSub.toString())
			.replace(singleBraceRegex, itemSub.toString())
			.replace(squareBracketRegex, itemSub.toString())
	}

	return substitutedText
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
	const { appUrl, companyUrl, dashboardUrl } = getTemplateContext()
	const templateData: Record<string, string | number | Date> = {
		...getBaseTemplateData(),
		email: senderEmail,
		message,
		timestamp
	}
	const text = substituteTemplateTokens(readFileSync(`./templates/${template}.txt`).toString(), templateData)
	await transport.sendMail({
		subject: `[${COMPANY_NAME}] - ${subject}`,
		replyTo: senderEmail,
		text,
		html: renderFile(`./templates/${template}.pug`, {
			pretty: true,
			email: senderEmail,
			message,
			timestamp,
			appUrl,
			companyName: COMPANY_NAME,
			companyUrl
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
	const { appUrl, companyUrl } = getTemplateContext()
	const templateData: Record<string, string | number | Date> = {
		...getBaseTemplateData(),
		...mailOptions.data
	}
	const subsititutedText = substituteTemplateTokens(text, templateData)

	
	await transport.sendMail({
		subject: mailOptions.subject,
		text: subsititutedText,
			html: renderFile(`./templates/${mailOptions.template}.pug`, {
				pretty: true,
				data: templateData,
				appUrl,
				companyName: COMPANY_NAME,
				companyUrl
			}),
		to: mailOptions.receipient,
		from: {
			name: 'Static Mailer',
			address: 'no-reply@staticmailer.com'
		}
	})
}
