# 아이 쑥쑥 성장 리포트

Android APK와 모바일·PC 브라우저에서 사용하는 육아 기록 앱의 0.1.0 로컬 MVP입니다.

**[Android 테스트 APK 다운로드](https://github.com/wjdghks1228/mybaby_project1_report/raw/refs/heads/main/downloads/ai-ssukssuk-0.1.0-debug.apk)**

Android 휴대폰에서 링크를 눌러 다운로드한 뒤 파일을 열어 설치하세요. 해당 브라우저 또는 파일 앱에 대한 출처별 앱 설치 허용이 필요할 수 있습니다. 이 버전은 개인 테스트용이며 부부 간·PC 웹 자동 동기화는 아직 제공하지 않습니다.

## 실행

Node.js 22 이상에서 외부 패키지 설치 없이 실행합니다.

```bash
cd mybaby_project1_report
npm start
```

브라우저에서 `http://localhost:4173`을 엽니다. 서버는 로컬 루프백에만 바인딩됩니다.

## 구현 범위

- 아이 이름·출생 여부·출생일/예정일 등록 및 변경
- 수유 유형·섭취량 기록, 직수량 미추정, 좌우 모유 타이머·일시정지·재개
- 기저귀 소변·대변·동시 기록
- 수면 시작·종료, 앱을 닫은 뒤 시작 시각 기반 복원
- 2단계 체온 선택 및 정확한 고체온 수치 입력
- 체중·신장·머리둘레와 기본 생활 활동 기록
- 기록 시각·값·메모 수정, 삭제 및 실행 취소
- 날짜별 캘린더, 최근 7/30일 실제 기록 통계
- 자정 경계 수면 분할, 겹친 수면 시간의 중복 집계 방지
- 24시간 동심원 패턴과 클릭 가능한 기록 상세
- JSON 백업·복원, 전체 데이터 삭제
- 모바일 하단 내비게이션·PC 대시보드

평균은 항목별 기록이 있는 날짜만 포함합니다. 미기록과 0을 구분하며, 모유 직수량과 미기록 시간의 활동은 추정하지 않습니다. 날짜는 실행 기기의 현지 시간대를 사용합니다. 원본 타임스탬프는 epoch 밀리초입니다.

## APK

빌드 결과 전달 파일: `artifacts/ai-ssukssuk-0.1.0-debug.apk`

Android 8.0(API 26) 이상을 대상으로 합니다. 이 APK는 **개인 테스트용 debug 서명**이며, 배포용 정식 서명과 Play Store 배포는 별도입니다. Android 시스템 WebView가 필요합니다. Android의 출처별 설치 허용 안내에 따라 설치할 수 있습니다.

앱은 인터넷 권한을 요청하지 않으며 웹 자산을 APK 안에 포함합니다. 네트워크가 없어도 기록할 수 있습니다. 백업 저장·복원은 Android 시스템 문서 선택기를 사용합니다.

### 다시 빌드

설치한 로컬 도구를 사용할 경우 다음과 같습니다. 도구 버전 디렉터리는 실제 설치 버전에 맞춥니다.

```bash
npm run android:assets
cd android
JAVA_HOME='/home/jhkim05/ai-ssukssuk/.tools/java/jdk-17.0.21+9' \
ANDROID_HOME='/home/jhkim05/ai-ssukssuk/.tools/sdk' \
GRADLE_USER_HOME='/home/jhkim05/ai-ssukssuk/.tools/gradle-home' \
../.tools/gradle-8.9/bin/gradle --offline --no-daemon :app:assembleDebug
```

Android Gradle Plugin 8.7.3, Gradle 8.9, JDK 17, compile/target SDK 35를 사용합니다. `.tools`, 빌드 결과, 서명 키는 Git 대상이 아닙니다. 이후 릴리스는 동일한 안전하게 보관한 서명 키로 서명해야 설치된 앱에 업데이트할 수 있습니다.

## 저장과 개인정보

현재 데이터는 앱 WebView 또는 해당 브라우저의 `localStorage`에 저장됩니다. 부모 간, 기기 간, APK와 웹 간 자동 동기화는 **아직 없습니다**. 브라우저 데이터 삭제·앱 제거 시 데이터가 사라질 수 있으므로 정기적으로 내보내세요. 백업에는 아이 이름·생년월일·건강 기록이 포함되므로 개인적으로 보관하고 공개 저장소에 올리지 마세요. 앱 자체 암호화·로그인·서버 백업은 아직 제공하지 않습니다.

## 후속 개발

- 인증·가족 초대·아이별 서버 접근 권한·공동 기록
- 서버 DB·실시간 동기화·오프라인 충돌 해결·감사 이력
- 사용자 설정 알림·투약·예방접종·이유식
- 상세 선택 항목·사진·다자녀 선택 UI
- 주/월/전체 집계·성장 기준 곡선·패턴 유형 필터
- 실기기 사용성·스크린리더·시스템 글자 확대 검증

## 검증

```bash
npm test
node --check app/app.js
```

집계 테스트와 로컬 HTTP 자산 응답을 검증합니다. Android 빌드·서명 검사는 실기기 화면 조작 검증을 대신하지 않습니다. 실제 사용 전 테스트 기록으로 설치·재실행·백업·복원을 확인하세요.

## GitHub를 통한 전달

Public 저장소의 GitHub Release에 APK를 첨부하면 로그인 없이 다운로드할 수 있습니다. Private 저장소는 다운로드 사용자에게 GitHub 로그인·저장소 접근 권한이 필요합니다. 소스와 분리한 공개 APK 배포 저장소도 사용할 수 있습니다. 이 저장소는 `downloads/`에 테스트 APK와 SHA-256 체크섬을 제공합니다. GitHub Releases 게시와 웹사이트 호스팅은 별도입니다.

APK 배포와 앱의 기록 동기화 서버는 별개입니다. GitHub 저장소를 아기의 건강 기록 저장소로 사용하지 않습니다.
