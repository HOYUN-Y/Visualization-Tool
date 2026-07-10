# Project Persistence Manual Test

이 체크리스트는 실제 브라우저의 IndexedDB와 다운로드 API가 필요한 Milestone 1 승인 테스트다.

## 준비

```bash
python3 -m http.server 8742
```

브라우저에서 `http://localhost:8742`를 열고 개발자 콘솔에 uncaught error가 없는지 확인한다.

## 1. 첫 실행과 자동저장

1. 기존 `insight-workbench` IndexedDB가 없는 새 프로필에서 앱을 연다.
2. 상단 프로젝트명이 `Untitled Project`, 저장 상태가 `Saved`인지 확인한다.
3. 테마, 모드, 패널 폭을 변경하고 데이터에 행 하나를 추가한다.
4. 저장 상태가 `Unsaved` → `Saving…` → `Saved`로 바뀌는지 확인한다.
5. 페이지를 새로고침해 UI 상태, 활성 데이터셋, 추가 행과 Clean pipeline이 복원되는지 확인한다.

## 2. 다중 프로젝트

1. `New`로 `Project B`를 생성하고 기본 데이터 상태로 시작하는지 확인한다.
2. 이름을 변경하고 복제한 뒤 프로젝트 목록에 각각 표시되는지 확인한다.
3. 프로젝트 사이를 전환해 각 프로젝트의 활성 데이터셋과 편집 내용이 분리되는지 확인한다.
4. 복제본을 삭제하고 현재 프로젝트 삭제 시 다른 프로젝트가 자동으로 열리는지 확인한다.
5. 마지막 프로젝트까지 삭제하면 새 `Untitled Project`가 생성되는지 확인한다.

## 3. JSON round trip

1. `Project JSON`으로 현재 프로젝트를 내려받는다.
2. 프로젝트에 변경을 가한 뒤 내려받은 파일을 `Restore JSON`으로 가져온다.
3. 동일 project ID가 이미 있으므로 `(Imported)` 이름의 새 프로젝트로 복원되는지 확인한다.
4. 데이터셋, Clean pipeline, Chart/Dashboard 설정, ML 이력이 원본과 일치하는지 확인한다.
5. JSON의 `schemaVersion`을 `2`로 바꾼 파일이 미래 버전 오류와 함께 거부되는지 확인한다.

## 4. 세션 전용 상태와 행 ID

1. Ask Insight를 열고 저장한 다음 새로고침한다.
2. Ask Insight가 닫힌 상태로 시작하는지 확인한다 (`ui.aiOpen` 제외 정책).
3. 기존 편집 행이 있는 프로젝트에서 새 행을 추가하고 편집/삭제가 올바른 행에 적용되는지 확인한다.

## 통과 기준

- 데이터 손실, 프로젝트 간 상태 누출, 중복 ID 덮어쓰기, uncaught error가 없어야 한다.
- 모든 저장 상태 전이가 동작하고 새로고침 후 결과가 동일해야 한다.
- 실패 시 브라우저/버전, 단계, 콘솔 오류, IndexedDB store 내용을 `WORKLOG.md`에 기록한다.
