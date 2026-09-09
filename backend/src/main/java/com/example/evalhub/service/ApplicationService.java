package com.example.evalhub.service;

import com.example.evalhub.dto.*;
import com.example.evalhub.entity.*;
import com.example.evalhub.repository.*;
import com.example.evalhub.util.PhoneNumbers;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final ApplicationAnswerRepository answerRepository;
    private final ProgramRepository programRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final ApplicationFormFieldRepository formFieldRepository;
    private final ParticipantAttachmentRepository attachmentRepository;
    private final PasswordEncoder passwordEncoder;

    public ApplicationService(
            ApplicationRepository applicationRepository,
            ApplicationAnswerRepository answerRepository,
            ProgramRepository programRepository,
            UserRepository userRepository,
            TeamRepository teamRepository,
            TeamMemberRepository teamMemberRepository,
            ApplicationFormFieldRepository formFieldRepository,
            ParticipantAttachmentRepository attachmentRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.applicationRepository = applicationRepository;
        this.answerRepository = answerRepository;
        this.programRepository = programRepository;
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.formFieldRepository = formFieldRepository;
        this.attachmentRepository = attachmentRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // 지원자 회원가입. 역할은 항상 MEMBER로 고정하며 비밀번호 원문은 저장하지 않는다.
    @Transactional
    public UserResponse signup(SignupRequest request) {
        if (request.email() == null || request.email().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required.");
        }
        if (request.password() == null || request.password().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password is required.");
        }
        String email = request.email().trim().toLowerCase();
        userRepository.findByEmailIgnoreCase(email).ifPresent(user -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists.");
        });

        String phone;
        try {
            phone = PhoneNumbers.normalize(request.phone());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }

        User user = new User(
                email,
                passwordEncoder.encode(request.password()),
                Role.MEMBER,
                request.name(),
                phone,
                request.department()
        );
        return UserResponse.from(userRepository.save(user));
    }

    // 프로그램 지원을 시작한다. 이미 지원서가 있으면 그대로 반환하고, 없으면 초안과 제출 대상 팀을 함께 만든다.
    @Transactional
    public ApplicationDetailResponse startApplication(Long programId, Long applicantId, StartApplicationRequest request) {
        Program program = programRepository.findById(programId)
                .orElseThrow(() -> notFound("Program not found."));
        User applicant = userRepository.findById(applicantId)
                .orElseThrow(() -> notFound("Applicant not found."));

        // 이미 지원서가 있으면 접수 상태와 무관하게 기존 지원서로 접근할 수 있게 한다.
        Application existing = applicationRepository
                .findByProgramIdAndApplicantId(programId, applicant.getId())
                .orElse(null);
        if (existing != null) {
            ensureTeam(existing); // 구버전에서 팀 없이 생성된 초안을 보정한다.
            return toDetail(existing);
        }

        // 신규 지원은 지원 접수 중(RECRUITING)이고 마감일이 지나지 않은 프로그램에만 허용한다.
        if (program.getStatus() != Status.RECRUITING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 지원을 접수하지 않는 프로그램입니다.");
        }
        if (program.getApplicationDeadline() != null && program.getApplicationDeadline().isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지원 기간이 마감되었습니다.");
        }

        return toDetail(createDraft(program, applicant, request.teamName()));
    }

    private Application createDraft(Program program, User applicant, String teamName) {
        Team team = createTeam(program, applicant, teamName);
        return applicationRepository.save(new Application(program, applicant, team));
    }

    // 제출 대상 팀을 만들고 지원자를 팀원(팀장)으로 등록한다. PDF 첨부는 이 팀에 연결된다.
    private Team createTeam(Program program, User applicant, String teamName) {
        String name = (teamName == null || teamName.isBlank()) ? "" : teamName.trim();

        Team team = teamRepository.save(new Team(
                program, name, program.getParticipantType(), null, name, null, null
        ));
        teamMemberRepository.save(new TeamMember(team, applicant));
        return team;
    }

    // 지원서에 제출 대상 팀이 없으면(구버전 데이터) 새로 만들어 연결한다.
    private void ensureTeam(Application application) {
        if (application.getTeam() != null) return;
        application.assignTeam(createTeam(application.getProgram(), application.getApplicant(), null));
    }

    // 지원서 단건 조회 (양식 항목 + 답변 + 첨부파일). 팀이 없으면 보정해 첨부가 가능하도록 한다.
    @Transactional
    public ApplicationDetailResponse getApplication(Long applicationId, Long applicantId) {
        Application application = getOwnedApplication(applicationId, applicantId);
        ensureTeam(application);
        return toDetail(application);
    }

    // 매니저가 팀 관리 화면에서 해당 팀의 지원 정보(본인/팀원 정보 + 양식 답변)를 열람한다.
    @Transactional(readOnly = true)
    public ApplicationDetailResponse getApplicationByTeam(Long teamId) {
        return applicationRepository.findByTeamId(teamId)
                .map(this::toDetail)
                .orElseThrow(() -> notFound("이 팀에 연결된 지원서가 없습니다."));
    }

    // 평가 화면에서는 매니저 전용 API를 거치지 않고, 배정 검증이 끝난 팀의 지원서를 함께 내려준다.
    // 매니저가 직접 만든 팀처럼 연결된 지원서가 없으면 null을 반환한다.
    @Transactional(readOnly = true)
    public ApplicationDetailResponse findApplicationByTeam(Long teamId) {
        return applicationRepository.findByTeamId(teamId)
                .map(this::toDetail)
                .orElse(null);
    }

    // 내 지원 현황 목록.
    @Transactional(readOnly = true)
    public List<ApplicationSummaryResponse> findMyApplications(Long applicantId) {
        return applicationRepository.findByApplicantIdOrderByUpdatedAtDesc(applicantId).stream()
                .map(ApplicationSummaryResponse::from)
                .toList();
    }

    // 임시저장: 답변과 팀명을 저장하고 초안 상태로 둔다. 제출된 지원서를 수정하면 초안으로 되돌린다.
    @Transactional
    public ApplicationDetailResponse saveDraft(Long applicationId, Long applicantId, SaveApplicationRequest request) {
        Application application = getOwnedApplication(applicationId, applicantId);
        validateApplicationOpen(application);
        applyContent(application, request);
        if (application.isSubmitted()) {
            application.reopen();
        } else {
            application.touch();
        }
        return toDetail(application);
    }

    // 최종 제출: 필수 항목 검증 후 SUBMITTED로 전환한다.
    @Transactional(noRollbackFor = SubmissionValidationException.class)
    public ApplicationDetailResponse submit(Long applicationId, Long applicantId, SaveApplicationRequest request) {
        Application application = getOwnedApplication(applicationId, applicantId);
        validateApplicationOpen(application);
        if (application.isSubmitted()) {
            application.reopen();
        } else {
            application.touch();
        }
        validateAnswerFields(application, request);
        applyContent(application, request);
        validateParticipant(application, request);
        validateRequired(application);
        application.submit();
        return toDetail(application);
    }

    // 팀 정보 탭에서 팀/본인 정보만 수정한다. 답변·첨부·제출 상태는 그대로 두고 Team 정보만 갱신한다.
    @Transactional
    public ApplicationDetailResponse updateTeamInfo(Long applicationId, Long applicantId, UpdateTeamInfoRequest request) {
        Application application = getOwnedApplication(applicationId, applicantId);
        validateApplicationOpen(application);
        if (application.getTeam() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이 지원서에는 수정할 팀 정보가 없습니다.");
        }
        validateTeamInfo(application, request);
        applyParticipantInfo(application, request.teamName(), request.participantName(),
                request.participantEmail(), request.participantPhone(), request.members());
        application.touch();
        return toDetail(application);
    }

    // 매니저가 팀 상세에서 팀이 제출한 지원 정보(팀명·본인/팀원·양식 답변)를 수정한다.
    // 지원자 소유권 검사 없이 팀 기준으로 찾고, 제출 상태(SUBMITTED/DRAFT)는 그대로 유지한다.
    @Transactional
    public ApplicationDetailResponse updateApplicationByTeam(Long teamId, SaveApplicationRequest request) {
        Application application = applicationRepository.findByTeamId(teamId)
                .orElseThrow(() -> notFound("이 팀에는 수정할 지원 정보가 없습니다."));
        validateAnswerFields(application, request);
        String phoneError = findPhoneError(request.participantPhone(), request.members());
        if (phoneError != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, phoneError);
        }
        applyContent(application, request);
        application.touch();
        return toDetail(application);
    }

    // 팀 정보 수정 시 필수 검증. 제출된 지원서가 무효화되지 않도록 팀 지원이면 팀명·팀장 이름을 요구한다.
    private void validateTeamInfo(Application application, UpdateTeamInfoRequest request) {
        ParticipantType pType = application.getProgram().getParticipantType();
        if (pType == ParticipantType.TEAM && trimOrNull(request.teamName()) == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "팀 이름을 입력해주세요.");
        }
        if (trimOrNull(request.participantName()) == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    pType == ParticipantType.TEAM ? "팀장(본인) 이름을 입력해주세요." : "이름을 입력해주세요.");
        }
        String phoneError = findPhoneError(request.participantPhone(), request.members());
        if (phoneError != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, phoneError);
        }
    }

    // 전화번호 형식 검증. 값이 비어 있으면 통과시키고(연락처는 선택 항목),
    // 값이 있는데 형식이 잘못된 경우에만 안내 문구를 반환한다. 문제가 없으면 null.
    private String findPhoneError(String participantPhone, List<SaveApplicationRequest.MemberInput> memberInputs) {
        if (trimOrNull(participantPhone) != null && !PhoneNumbers.isValid(participantPhone)) {
            return "연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)";
        }
        List<SaveApplicationRequest.MemberInput> inputs = memberInputs == null ? List.of() : memberInputs;
        for (int i = 0; i < inputs.size(); i++) {
            SaveApplicationRequest.MemberInput m = inputs.get(i);
            if (m == null || trimOrNull(m.phone()) == null) continue;
            if (!PhoneNumbers.isValid(m.phone())) {
                return "팀원 " + (i + 1) + "의 연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)";
            }
        }
        return null;
    }

    // 지원서의 제출 대상 팀에 본인/팀원 정보를 반영한다. 임시저장·제출·팀 정보 수정에서 공유한다.
    private void applyParticipantInfo(Application application, String teamName, String participantName,
            String participantEmail, String participantPhone, List<SaveApplicationRequest.MemberInput> memberInputs) {
        Team team = application.getTeam();
        if (team == null) return;

        ParticipantType pType = application.getProgram().getParticipantType();
        team.updateParticipantType(pType);

        // 전화번호는 숫자만 남겨 저장한다. 임시저장 중인 미완성 번호까지 버리지 않도록
        // 여기서는 자릿수를 따지지 않고, 제출·팀 정보 수정 시점에 validatePhones()로 검증한다.
        List<ApplicantInfo.Member> members = (pType == ParticipantType.TEAM && memberInputs != null)
                ? memberInputs.stream()
                    .filter(m -> m != null && (trimOrNull(m.name()) != null || trimOrNull(m.email()) != null
                            || PhoneNumbers.toDigits(m.phone()) != null))
                    .map(m -> new ApplicantInfo.Member(
                            trimOrNull(m.name()), trimOrNull(m.email()), PhoneNumbers.toDigits(m.phone())))
                    .toList()
                : List.of();

        String phone = PhoneNumbers.toDigits(participantPhone);
        ApplicantInfo info = new ApplicantInfo(
                trimOrNull(participantName), trimOrNull(participantEmail), phone, members);

        // 매니저 목록에 표시할 이름: 팀 지원이면 팀명, 개인 지원이면 지원자 이름
        String displayName = pType == ParticipantType.TEAM ? trimOrNull(teamName) : trimOrNull(participantName);

        team.applyApplicantInfo(displayName, info.toJson(), phone);
    }

    private void validateAnswerFields(Application application, SaveApplicationRequest request) {
        List<SaveApplicationRequest.AnswerInput> inputs = request.answers() == null ? List.of() : request.answers();
        for (SaveApplicationRequest.AnswerInput input : inputs) {
            if (input == null || input.formFieldId() == null) continue;
            ApplicationFormField field = formFieldRepository.findById(input.formFieldId())
                    .orElseThrow(() -> new SubmissionValidationException(
                            "Form field not found: " + input.formFieldId()));
            if (!field.getProgram().getId().equals(application.getProgram().getId())) {
                throw new SubmissionValidationException("Form field does not belong to this program.");
            }
        }
    }

    // 지원 취소: 지원서와 제출 대상 팀(및 첨부파일)을 함께 삭제한다.
    // 평가 시작 이후에는 셀프서비스 취소를 막는다. (담당자 문의로 처리)
    @Transactional
    public void cancelApplication(Long applicationId, Long applicantId) {
        Application application = getOwnedApplication(applicationId, applicantId);
        validateCancellable(application);
        Team team = application.getTeam();
        applicationRepository.delete(application);
        if (team != null) {
            teamRepository.delete(team);
        }
    }

    // 본인/팀원 정보와 답변을 저장한다. 임시저장·제출에서 공유한다.
    private void applyContent(Application application, SaveApplicationRequest request) {
        applyParticipantInfo(application, request.teamName(), request.participantName(),
                request.participantEmail(), request.participantPhone(), request.members());

        List<SaveApplicationRequest.AnswerInput> inputs = request.answers() == null ? List.of() : request.answers();
        Map<Long, ApplicationAnswer> existing = answerRepository.findByApplicationId(application.getId()).stream()
                .collect(Collectors.toMap(a -> a.getFormField().getId(), Function.identity()));

        for (SaveApplicationRequest.AnswerInput input : inputs) {
            if (input.formFieldId() == null) continue;
            ApplicationFormField field = formFieldRepository.findById(input.formFieldId())
                    .orElseThrow(() -> notFound("Form field not found: " + input.formFieldId()));
            if (!field.getProgram().getId().equals(application.getProgram().getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Form field does not belong to this program.");
            }

            ApplicationAnswer answer = existing.get(field.getId());
            if (answer == null) {
                answerRepository.save(new ApplicationAnswer(application, field, input.value()));
            } else {
                answer.updateValue(input.value());
            }
        }
    }

    // 지원 마감일이 지난 프로그램은 임시저장·제출·팀 정보 수정 모두 막는다. (조회·취소는 계속 허용)
    private void validateApplicationOpen(Application application) {
        LocalDate deadline = application.getProgram().getApplicationDeadline();
        if (deadline != null && LocalDate.now().isAfter(deadline)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지원 마감일이 지나 지원서를 수정할 수 없습니다.");
        }
    }

    // 평가 시작일 이후에는 지원 취소를 막는다. (이미 배정된 심사에 영향을 주므로 담당자 문의로 처리)
    private void validateCancellable(Application application) {
        LocalDate evaluationStart = application.getProgram().getEvaluationStart();
        if (evaluationStart != null && !LocalDate.now().isBefore(evaluationStart)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "평가 시작 이후에는 지원을 취소할 수 없습니다. 담당자에게 문의해주세요.");
        }
    }

    // 제출 시 본인/팀 정보 필수 검증. 팀 지원이면 팀 이름도 필수.
    private void validateParticipant(Application application, SaveApplicationRequest request) {
        ParticipantType pType = application.getProgram().getParticipantType();
        if (pType == ParticipantType.TEAM && trimOrNull(request.teamName()) == null) {
            throw new SubmissionValidationException("팀 이름을 입력해주세요.");
        }
        if (trimOrNull(request.participantName()) == null) {
            throw new SubmissionValidationException(
                    pType == ParticipantType.TEAM ? "팀장(본인) 이름을 입력해주세요." : "이름을 입력해주세요.");
        }
        String phoneError = findPhoneError(request.participantPhone(), request.members());
        if (phoneError != null) {
            throw new SubmissionValidationException(phoneError);
        }
    }

    // 필수 항목 검증: 파일 항목은 첨부파일 존재로, 나머지는 답변 값 존재로 확인한다.
    private void validateRequired(Application application) {
        List<ApplicationFormField> fields = formFieldRepository
                .findByProgramIdOrderByDisplayOrderAsc(application.getProgram().getId());
        Map<Long, String> answers = answerRepository.findByApplicationId(application.getId()).stream()
                .filter(a -> a.getValue() != null)
                .collect(Collectors.toMap(a -> a.getFormField().getId(), ApplicationAnswer::getValue));
        boolean hasAttachment = application.getTeam() != null
                && !attachmentRepository.findByTeamIdOrderByUploadedAtDesc(application.getTeam().getId()).isEmpty();

        for (ApplicationFormField field : fields) {
            if (!field.isRequired()) continue;
            if (isFileField(field.getFieldType())) {
                if (!hasAttachment) {
                    throw new SubmissionValidationException(
                            "필수 첨부파일이 없습니다: " + field.getLabel());
                }
            } else {
                String value = answers.get(field.getId());
                if (value == null || value.isBlank()) {
                    throw new SubmissionValidationException(
                            "필수 항목이 비어 있습니다: " + field.getLabel());
                }
            }
        }
    }

    private static class SubmissionValidationException extends ResponseStatusException {
        private SubmissionValidationException(String reason) {
            super(HttpStatus.BAD_REQUEST, reason);
        }
    }

    private boolean isFileField(String fieldType) {
        if (fieldType == null) return false;
        String t = fieldType.toLowerCase();
        return t.contains("file") || t.contains("pdf") || t.contains("attachment") || t.contains("첨부");
    }

    private ApplicationDetailResponse toDetail(Application application) {
        Map<Long, String> answers = answerRepository.findByApplicationId(application.getId()).stream()
                .collect(Collectors.toMap(a -> a.getFormField().getId(), a -> a.getValue() == null ? "" : a.getValue()));

        List<ApplicationDetailResponse.FieldAnswer> fields = formFieldRepository
                .findByProgramIdOrderByDisplayOrderAsc(application.getProgram().getId()).stream()
                .map(f -> new ApplicationDetailResponse.FieldAnswer(
                        f.getId(), f.getLabel(), f.getFieldType(), f.isRequired(), f.getDisplayOrder(),
                        FormFieldResponse.splitOptions(f.getOptions()),
                        answers.getOrDefault(f.getId(), null)
                ))
                .toList();

        List<ParticipantAttachmentResponse> attachments = application.getTeam() == null
                ? List.of()
                : attachmentRepository.findByTeamIdOrderByUploadedAtDesc(application.getTeam().getId()).stream()
                        .map(ParticipantAttachmentResponse::from)
                        .toList();

        Team team = application.getTeam();
        Program program = application.getProgram();

        // 팀 지원서는 계정 정보를 자동 입력하지 않고, 지원자가 직접 저장한 값만 반환한다.
        // 개인 지원서만 기존처럼 계정 이름·이메일을 초기값으로 사용할 수 있다.
        User acc = application.getApplicant();
        ApplicantInfo stored = ApplicantInfo.of(team);
        String teamName = team == null ? null : team.getName();
        if (team != null
                && program.getParticipantType() == ParticipantType.TEAM
                && application.getStatus() == ApplicationStatus.DRAFT
                && (team.getApplicantInfo() == null || team.getApplicantInfo().isBlank())) {
            teamName = "";
        }
        boolean isTeamApplication = program.getParticipantType() == ParticipantType.TEAM;
        String applicantName = isTeamApplication
                ? stored.name()
                : firstNonBlank(stored.name(), acc.getName());
        String applicantEmail = isTeamApplication
                ? stored.email()
                : firstNonBlank(stored.email(), acc.getEmail());
        ApplicantInfo applicantInfo = new ApplicantInfo(
                applicantName,
                applicantEmail,
                stored.phone(),
                stored.members()
        );

        return new ApplicationDetailResponse(
                application.getId(),
                program.getId(),
                program.getTitle(),
                application.getApplicant().getId(),
                team == null ? null : team.getId(),
                teamName,
                application.getStatus(),
                program.getApplicationDeadline(),
                program.getEvaluationStart(),
                application.getSubmittedAt(),
                application.getUpdatedAt(),
                program.isAttachmentsEnabled(),
                program.getMaxAttachments(),
                program.getParticipantType(),
                applicantInfo,
                fields,
                attachments
        );
    }

    private Application getOwnedApplication(Long applicationId, Long applicantId) {
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> notFound("Application not found."));
        if (!application.getApplicant().getId().equals(applicantId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Application does not belong to this user.");
        }
        return application;
    }

    // 팀 이름/개인 이름을 아직 입력하기 전의 기본 표시 이름. 지원자 이름을 사용한다.
    private String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private String firstNonBlank(String a, String b) {
        return (a != null && !a.isBlank()) ? a : b;
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }
}
