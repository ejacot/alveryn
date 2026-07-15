FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw --batch-mode dependency:go-offline
COPY src src
RUN ./mvnw --batch-mode -DskipTests clean package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/target/alveryn-api-0.0.1-SNAPSHOT.jar app.jar
RUN useradd --system --uid 10001 alveryn
USER 10001
EXPOSE 10000
ENTRYPOINT ["sh", "-c", "if [ \"${DB_URL#postgresql://}\" != \"$DB_URL\" ]; then DB_AUTHLESS=\"${DB_URL#postgresql://}\"; DB_AUTHLESS=\"${DB_AUTHLESS#*@}\"; export DB_URL=\"jdbc:postgresql://${DB_AUTHLESS}\"; fi; exec java -jar /app/app.jar"]
