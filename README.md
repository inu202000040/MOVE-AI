# MOVE AI

MOVE AI의 clean-room 구현 저장소다. 구현 입력은 승인된 Figma 디자인, PNG export, 기술명세, 데이터팩, 공식 제3자 문서로 제한한다.

현재 상태는 `CP0_PREP`이다. 애플리케이션 구현은 디자인 입력과 WT1~WT6 구현 명세가 동결된 뒤 시작한다.

## CP0 문서

- `docs/00_ALLOWED_INPUTS.md`: 허용·금지 입력과 실제 SHA-256
- `docs/01_REPOSITORY_STRUCTURE.md`: 신규 저장소 소유권과 디렉터리 구조
- `docs/02_FROZEN_CONTRACTS_DRAFT.md`: 시작 10~15분 안에 확정할 공통 계약 초안

## Clean-room 원칙

- 이전 애플리케이션 저장소의 코드, 스타일, 테스트, 생성 산출물 또는 Git history를 가져오지 않는다.
- 구현자는 승인된 디자인·명세·데이터팩과 공식 라이브러리 문서만 사용한다.
- 데이터 fixture와 snapshot은 승인된 원천 파일에서 결정론적으로 다시 생성한다.
- Figma·PNG 입력은 실제 파일 또는 검증 가능한 공유 버전이 제공된 뒤 SHA-256과 시각을 동결한다.

