// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');
const path = require('path');

const app = express();
app.use(cors());

// 정적 파일(HTML 등) 제공
app.use(express.static(path.join(__dirname, 'public'))); 
// (참고: index.html 파일은 public 폴더 안에 넣거나, 경로를 맞게 수정해야 합니다)

// Notion 클라이언트 초기화
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

// 노션 데이터 가져오기 API
app.get('/api/notion', async (req, res) => {
    try {
        const response = await notion.databases.query({
            database_id: databaseId,
            sorts: [
                {
                    property: 'Date', // 날짜 기준으로 최신순 정렬
                    direction: 'descending',
                },
            ],
        });

        // 노션의 복잡한 데이터를 깔끔하게 정리 (오너가 설정한 속성 이름 기준)
        const messages = response.results.map((page) => {
            // 속성(Properties) 추출 (노션 데이터 구조상 예외 처리가 필수입니다)
            const titleProperty = page.properties['Name'] || page.properties['이름']; // 제목 열 이름에 따라 수정 필요
            const title = titleProperty?.title[0]?.plain_text || '제목 없음';
            const date = page.properties['Date']?.date?.start || '-';
            const status = page.properties['Status']?.select?.name || '-';
            const receiver = page.properties['수신']?.rich_text[0]?.plain_text || '-';
            const sender = page.properties['발신']?.rich_text[0]?.plain_text || '-';
            const isFree = page.properties['무료공개']?.checkbox || false;

            return { id: page.id, title, date, status, receiver, sender, isFree };
        });

        res.json({ success: true, data: messages });
    } catch (error) {
        console.error('Notion API 에러:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); 
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proposition T Server is running on port ${PORT}`);
});