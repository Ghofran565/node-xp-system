// Utils/notifier.js
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import HandleError from './handleError.js';
import catchAsync from './catchAsync.js';
import { log, logger } from './logger.js';
import VerificationToken from '../Models/VerificationTokenMd.js';

const createTransporter = () => {
	if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
		throw new HandleError('Email credentials not configured in .env', 500);
	}
	try {
		return nodemailer.createTransport({
			service: 'Gmail',
			host: 'smtp.gmail.com',
			port: 465,
			secure: true,
			auth: {
				user: process.env.EMAIL_USER,
				pass: process.env.EMAIL_PASS,
			},
		});
	} catch (error) {
		logger.error('Failed to create email transporter:', error);
		log('faild to transport create, you are fucked').warn().white();
		throw new HandleError('Failed to initialize email service', 500);
	}
};

const generateVerificationCode = () => {
	log('randomINt').warn().white();
	return crypto.randomInt(10000, 99999).toString();
};

const sendMail = async (transporter, mailOptions) => {
	try {
		await transporter.sendMail(mailOptions);
		logger.info(
			`Email sent to ${mailOptions.to} for purpose: ${mailOptions.subject}`
		);
	} catch (error) {
		logger.error(`Failed to send email to ${mailOptions.to}:`, error);
		log('didint sent email').warn().white();
		throw new HandleError('Failed to send email. Please try again later.', 500);
	}
};

export const sendEmailCode = catchAsync(async (email, options = {}) => {
	const { playerId, purpose, content } = options;
	const generatedCode = generateVerificationCode();
	await VerificationToken.create({ playerId, email, code: generatedCode }); // 5-minute expiry

	const transporter = createTransporter();
	let subject, text;
	switch (purpose) {
		case 'verify':
			subject = 'Verify Your Email 🚀';
			text = `Welcome! Your verification code is ${generatedCode}. It expires in 5 minutes.`;
			break;
		case 'reset':
			subject = 'Password Reset Request 📧';
			text = `Your password reset code is ${generatedCode}. It expires in 5 minutes.`;
			break;
		case 'rank':
			subject = 'Rank Up! 🎉';
			text = content || `Congratulations! You've advanced to a new rank.`;
			break;
		case 'tournament':
			subject = 'Tournament Update 🏆';
			text = content || `A new tournament is starting! Check your tasks.`;
			break;
		case 'alert':
			subject = 'Admin Alert ⚠️';
			text = content || `An anomaly has been detected.`;
			break;
		default:
			subject = 'Custom Email 📩';
			text = content || `This is a custom email.`;
	}

	const mailOptions = {
		from: process.env.EMAIL_USER,
		to: email,
		subject,
		text,
		...(playerId && { headers: { 'X-Player-Id': playerId } }), // Optional tracking
	};

	await sendMail(transporter, mailOptions);
	log('email semmes to be sent').warn().white();
	return {
		status: 'SUCCESS',
		totalCount: 1,
		message: 'Email sent successfully.',
	};
});
export const verifyEmailCode = async (email, code, purpose = 'verify') => {
    const emailVerificationChecks = await VerificationToken.find({
        email,
    }).lean();

    console.log(code);
    console.log(email);
    console.log(emailVerificationChecks);

    const isCodeValid = emailVerificationChecks.some(token => token.code === code);

    if (!isCodeValid) {
        return {
            authorized: false,
            status: 'FAILED',
            totalCount: 0,
            message: 'Verification code is incorrect or expired.',
        };
    }

    await VerificationToken.deleteMany({
        email,
    }).lean();

    return {
        authorized: true,
        status: 'SUCCESS',
        totalCount: 1,
        message: 'Email authorized successfully.',
    };
};

export const sendCustomEmail = async (email, subject, content) => {
	const transporter = createTransporter();
	const mailOptions = {
		from: process.env.EMAIL_USER,
		to: email,
		subject: subject || 'Custom Email 📩',
		text: content || 'This is a custom email.',
	};

	await sendMail(transporter, mailOptions);
	return {
		status: 'SUCCESS',
		totalCount: 1,
		message: 'Custom email sent successfully.',
	};
};
