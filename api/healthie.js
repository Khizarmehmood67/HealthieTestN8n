import fetch from 'node-fetch';

export default async function handler(req, res) {
    // Respond to preflight OPTIONS requests to satisfy the browser
    const healthieUrl = process.env.REACT_APP_HEALTHIE_BASE_URL;
    const apiKey = process.env.REACT_APP_HEALTHIE_TOKEN;

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(201).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        return res.status(405).end('Method Not Allowed');
    }
    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(req.body),
    };
    console.log("Request going to Healthie:", JSON.stringify(requestOptions, null, 2));

    try {
        const healthieResponse = await fetch(healthieUrl, requestOptions);
        res.setHeader('Authorization', `Bearer ${apiKey}`);
        console.log("healthie response", healthieResponse);

        const data = await healthieResponse.json();

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(healthieResponse.status).json(data);
    } catch (error) {
        console.error('Error fetching data from Healthie:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
