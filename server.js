const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(express.json({limit:'5mb'}));
app.use(express.static(__dirname));

const useSsl = process.env.DATABASE_SSL === 'true';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: useSsl ? {rejectUnauthorized:false} : false });