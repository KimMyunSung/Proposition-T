from flask import Flask, render_template, request, jsonify
import requests
import os

app = Flask(__name__)

# ❗ 중요: 아까 발급받은 API Key를 여기에 넣으세요 (Key ... 형식)
# 예: "Key q234... (매우 긴 문자열)"
PI_API_KEY = os.environ.get("PI_API_KEY")

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/validation-key.txt')
def validation_key():
    return os.environ.get("PI_VALIDATION_KEY")

# 1. 결제 승인 (Approve) 처리
@app.route('/approve', methods=['POST'])
def approve_payment():
    data = request.json
    payment_id = data.get('paymentId')
    
    print(f"🚀 결제 승인 요청 받음: {payment_id}")

    # 파이 서버에 승인 요청 보내기
    url = f"https://api.minepi.com/v2/payments/{payment_id}/approve"
    headers = {"Authorization": PI_API_KEY}
    
    # 여기서 텅 빈 JSON({})을 보내야 함
    resp = requests.post(url, json={}, headers=headers)
    
    print(f"✅ 파이 서버 응답: {resp.status_code}")
    return jsonify(resp.json())

# 2. 결제 완료 (Complete) 처리
@app.route('/complete', methods=['POST'])
def complete_payment():
    data = request.json
    payment_id = data.get('paymentId')
    txid = data.get('txid') # 블록체인 트랜잭션 ID

    print(f"🎉 결제 완료 요청 받음: {payment_id}, TXID: {txid}")

    # 파이 서버에 완료 보고
    url = f"https://api.minepi.com/v2/payments/{payment_id}/complete"
    headers = {"Authorization": PI_API_KEY}
    
    data = {"txid": txid}
    resp = requests.post(url, json=data, headers=headers)
    
    return jsonify(resp.json())

if __name__ == '__main__':
    # 5000번 포트에서 실행
    app.run(host='0.0.0.0', port=5000, debug=True)