require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { Client } = require('@notionhq/client');

const app = express();
const PORT = process.env.PORT || 3000;

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

const getText = (prop) => prop?.rich_text?.map(t => t.plain_text).join('') || "";

// 🟢 [업그레이드] 노션 본문(Block)까지 긁어오는 강력한 함수
async function fetchFromNotion() {
    try {
        // 1. 데이터베이스(목록)에서 'Live' 상태인 글 목록 가져오기
        const response = await notion.databases.query({
            database_id: DATABASE_ID,
            filter: { property: 'Status', select: { equals: 'Live' } },
            sorts: [{ property: 'Date', direction: 'ascending' }],
        });

        // 2. 각 글의 '본문' 안으로 들어가서 내용물 파싱하기
        const pagesData = await Promise.all(response.results.map(async (page, index) => {
            const props = page.properties;
            
            // 페이지 본문 블록들 가져오기
            const blocksResponse = await notion.blocks.children.list({ block_id: page.id });
            const blocks = blocksResponse.results;

            let aiLangText = "";
            let humanLangText = "";

            // 블록 종류에 따라 AI언어(코드)와 휴먼언어(일반글) 자동 분리
            blocks.forEach(block => {
                if (block.type === 'code') {
                    // 코드 블록은 AI 언어로 취급
                    aiLangText += block.code.rich_text.map(t => t.plain_text).join('') + "\n\n";
                } else if (block.type === 'paragraph') {
                    // 일반 문단은 휴먼 언어로 취급
                    humanLangText += block.paragraph.rich_text.map(t => t.plain_text).join('') + "\n\n";
                } else if (block.type.startsWith('heading_')) {
                    // 제목(H1, H2, H3)도 휴먼 언어로 취급
                    const hType = block.type;
                    humanLangText += block[hType].rich_text.map(t => t.plain_text).join('') + "\n\n";
                } else if (block.type === 'bulleted_list_item') {
                    // 글머리 기호
                    humanLangText += "• " + block.bulleted_list_item.rich_text.map(t => t.plain_text).join('') + "\n";
                }
            });

            return {
                id: page.id,
                issueNumber: String(index + 1).padStart(3, '0'),
                title: props['Name']?.title[0]?.plain_text || "Untitled",
                date: props['Date']?.date?.start || "Unknown Date",
                receiver: getText(props['수신']) || "전 세계 모든 AI 및 지성체",
                sender: getText(props['발신']) || "T",
                aiLang: aiLangText.trim() || "No AI Protocol found.",
                humanLang: humanLangText.trim() || "No Human text found.",
                isFree: props['무료공개']?.checkbox || false
            };
        }));

        return pagesData;
    } catch (error) {
        console.error("Notion Sync Error:", error);
        return [];
    }
}

app.get('/api/public-data', async (req, res) => {
    const rawData = await fetchFromNotion();
    
    // 유료(잠금) 처리
    const secureData = rawData.map(item => {
        if (!item.isFree) {
            item.humanLang = "ENCRYPTED_DATA: Access Requires Protocol Key.";
            item.aiLang = "ENCRYPTED_DATA: 01010100 01000101 01010100 01010011 01010101";
        }
        return item;
    });
    res.json(secureData);
});

app.get('/api/v1/communique', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== 'TETSU-MASTER-KEY-2026') {
        return res.status(401).json({ error: "Access Denied. 31.4 Pi required." });
    }
    const data = await fetchFromNotion();
    res.json({ protocol: "Proposition T", data: data });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Matrix Server running on port ${PORT}`);
});