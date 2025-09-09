import fetch from 'node-fetch';

export default async function handler(req, res) {
    // Respond to preflight OPTIONS requests to satisfy the browser
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST', 'OPTIONS']);
        return res.status(405).end('Method Not Allowed');
    }

    const healthieUrl = process.env.REACT_APP_HEALTHIE_BASE_URL;
    const apiKey = process.env.REACT_APP_HEALTHIE_TOKEN;

    try {
        const healthieResponse = await fetch(healthieUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(req.body),
        });

        const data = await healthieResponse.json();

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(healthieResponse.status).json(data);
    } catch (error) {
        console.error('Error fetching data from Healthie:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
