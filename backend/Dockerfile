FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /workspace

COPY . .
RUN chmod +x gradlew \
    && ./gradlew --no-daemon bootJar \
    && find build/libs -name '*-plain.jar' -delete \
    && cp build/libs/*.jar /workspace/app.jar

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

RUN groupadd --system evalon \
    && useradd --system --gid evalon evalon \
    && mkdir -p /app/uploads/attachments \
    && chown -R evalon:evalon /app

COPY --from=build --chown=evalon:evalon /workspace/app.jar /app/app.jar

USER evalon
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]